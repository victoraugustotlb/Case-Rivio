import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { emptyProfile, parseProfileLenient, profileSchema, type HealthProfile } from "./profile";
import { ESSENTIAL_FIELDS } from "./profile-completion";
import { loadProfile, writeProfile } from "./profile-write";
import { applySuggestion, cleanSuggestions, type SuggestionField } from "./profile-suggestions";

export const getHealthProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => loadProfile(context.supabase, context.userId));

export const saveHealthProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => profileSchema.parse(input))
  .handler(async ({ data, context }) => {
    const prev = await loadProfile(context.supabase, context.userId);
    await writeProfile(context.supabase, context.userId, prev, { ...data, field_sources: prev?.field_sources ?? {} }, { origem: "paciente" });
    return { saved: true };
  });

/** Alteração parcial (modo simples, "Não tenho", cartão do início). Grava a cada resposta. */
export const patchHealthProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ patch: z.record(z.string(), z.unknown()), accountName: z.string().max(150).optional() }).parse(input))
  .handler(async ({ data, context }) => {
    const prev = await loadProfile(context.supabase, context.userId);
    const base = prev ?? { ...emptyProfile, full_name: data.accountName ?? "" };
    const { field_sources: _ignored, ...patch } = data.patch;
    const parsed = profileSchema.safeParse({ ...base, ...patch });
    if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Confira a resposta." };
    const profile = await writeProfile(context.supabase, context.userId, prev, { ...parsed.data, field_sources: base.field_sources }, { origem: "paciente" });
    return { ok: true as const, profile };
  });

/** O dono desfaz uma alteração feita por um cuidador: volta ao valor anterior. */
export const undoCaregiverEdit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ column: z.string().max(40) }).parse(input))
  .handler(async ({ data, context }) => {
    const prev = await loadProfile(context.supabase, context.userId);
    const src = prev?.field_sources[data.column];
    if (!prev || !src || src.origem !== "cuidador" || !(data.column in prev)) return { ok: false as const, error: "Não há alteração para desfazer." };
    const fallback = (emptyProfile as Record<string, unknown>)[data.column];
    const parsed = profileSchema.safeParse({ ...prev, [data.column]: src.anterior ?? fallback });
    if (!parsed.success) return { ok: false as const, error: "Não foi possível desfazer." };
    await writeProfile(context.supabase, context.userId, prev, parsed.data, { origem: "paciente" });
    return { ok: true as const };
  });

// ---------- Configurações ----------
export const settingsSchema = z.object({
  default_share_essentials: z.boolean(),
  essentials_fields: z.array(z.enum(ESSENTIAL_FIELDS)).max(ESSENTIAL_FIELDS.length),
  large_text: z.boolean(),
  guided_mode: z.boolean(),
});
export type PatientSettings = z.infer<typeof settingsSchema>;
export const DEFAULT_SETTINGS: PatientSettings = { default_share_essentials: true, essentials_fields: [...ESSENTIAL_FIELDS], large_text: false, guided_mode: false };

export const getPatientSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PatientSettings> => {
    const { data } = await context.supabase.from("patient_settings").select("default_share_essentials,essentials_fields,large_text,guided_mode").eq("user_id", context.userId).maybeSingle();
    const parsed = settingsSchema.safeParse(data);
    return parsed.success ? parsed.data : DEFAULT_SETTINGS;
  });

export const savePatientSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => settingsSchema.partial().parse(input))
  .handler(async ({ data, context }) => {
    const { data: cur } = await context.supabase.from("patient_settings").select("default_share_essentials,essentials_fields,large_text,guided_mode").eq("user_id", context.userId).maybeSingle();
    const patch = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)) as Partial<PatientSettings>;
    const merged: PatientSettings = { ...DEFAULT_SETTINGS, ...(settingsSchema.safeParse(cur).data ?? {}), ...patch };
    const { error } = await context.supabase.from("patient_settings").upsert({ ...merged, user_id: context.userId, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) throw new Error("Não foi possível salvar a configuração.");
    return merged;
  });

// ---------- Visão geral do perfil ----------
export const getProfileOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const [{ data: m }, { data: docs }, { data: sugg }] = await Promise.all([
      sb.from("plan_memberships").select("card_number,role,status,plan_id").eq("user_id", context.userId).maybeSingle(),
      sb.from("documents").select("id,title,kind,doc_date,created_at").eq("status", "accepted").order("created_at", { ascending: false }).limit(50),
      sb.from("profile_suggestions").select("id,field,value,source_document_id,excerpt,confidence,created_at").eq("status", "pending").order("created_at", { ascending: false }).limit(30),
    ]);
    let plan: { name: string; last4: string; role: string; status: string } | null = null;
    if (m) {
      const { data: p } = await sb.from("insurance_plans").select("name").eq("id", m.plan_id).maybeSingle();
      plan = { name: p?.name ?? "Plano", last4: m.card_number.slice(-4), role: m.role, status: m.status };
    }
    const all = docs ?? [];
    return {
      plan,
      latestDocs: all.slice(0, 3),
      docTitles: Object.fromEntries(all.map((d) => [d.id, { title: d.title, date: d.doc_date }])) as Record<string, { title: string; date: string | null }>,
      candidateDocIds: all.slice(0, 10).map((d) => d.id),
      suggestions: (sugg ?? []).map((s) => ({ ...s, field: s.field as SuggestionField, confidence: Number(s.confidence) })),
    };
  });

// ---------- Sugestões a partir de documentos ----------
const conf = { type: "number", description: "0 a 1: quão claro está no documento" } as const;
const item = (valor: object) => ({ type: "object", additionalProperties: false, required: ["valor", "trecho", "confianca"], properties: { valor, trecho: { type: "string", description: "Citação literal do documento" }, confianca: conf } });
const nullable = (o: object) => ({ anyOf: [o, { type: "null" }] });
const suggestSchema = {
  type: "object", additionalProperties: false,
  required: ["tipo_sanguineo", "alergias", "medicamentos", "condicoes", "altura_cm", "peso_kg"],
  properties: {
    tipo_sanguineo: nullable(item({ type: "string", enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] })),
    alergias: { type: "array", items: item({ type: "string" }) },
    medicamentos: { type: "array", items: { type: "object", additionalProperties: false, required: ["nome", "dose", "frequencia", "trecho", "confianca"], properties: { nome: { type: "string" }, dose: { type: "string" }, frequencia: { type: "string" }, trecho: { type: "string" }, confianca: conf } } },
    condicoes: { type: "array", items: item({ type: "string" }) },
    altura_cm: nullable(item({ type: "number" })),
    peso_kg: nullable(item({ type: "number" })),
  },
} as const;

export const suggestProfileFromDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ documentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    // RLS + filtro: só documentos do próprio usuário, já confirmados e aceitos.
    const { data: doc } = await sb.from("documents").select("id,user_id,title,kind,doc_date,file_path,fields,summary,confirmed,status").eq("id", data.documentId).eq("user_id", context.userId).maybeSingle();
    if (!doc || !doc.confirmed || doc.status !== "accepted") return { ok: false as const, error: "Documento não disponível." };
    const { count } = await sb.from("profile_suggestions").select("id", { count: "exact", head: true }).eq("source_document_id", doc.id);
    if ((count ?? 0) > 0) return { ok: true as const, created: 0, already: true };

    const content: any[] = [{ type: "input_text", text: `Documento "${doc.title}" (${doc.kind}${doc.doc_date ? `, ${doc.doc_date}` : ""}). Campos já conferidos pelo paciente: ${JSON.stringify(doc.fields ?? []).slice(0, 8000)}. Extraia os dados do perfil em JSON.` }];
    if (doc.file_path?.startsWith(`${context.userId}/`)) {
      const { data: blob } = await sb.storage.from("medical-documents").download(doc.file_path);
      if (blob && blob.size < 15_000_000) {
        const mime = blob.type || (doc.file_path.endsWith(".pdf") ? "application/pdf" : "image/jpeg");
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let bin = "";
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        const url = `data:${mime};base64,${btoa(bin)}`;
        content.push(mime === "application/pdf" ? { type: "input_file", filename: "documento.pdf", file_data: url } : { type: "input_image", image_url: url, detail: "high" });
      }
    }
    const { generateResponse } = await import("@lovable.dev/ai-gateway");
    let out = "";
    try {
      const res = await generateResponse({
        model: "openai/gpt-6-astra",
        instructions: "Você lê documentos médicos brasileiros e encontra dados para o perfil do paciente: tipo sanguíneo, alergias, medicamentos de uso contínuo, condições/diagnósticos já escritos no documento, altura e peso. " +
          "Só informe o que estiver ESCRITO no documento, com a citação literal em 'trecho'. Se o documento não traz o dado, use null (ou lista vazia). Nunca deduza, nunca invente, nunca diagnostique.",
        input: [{ role: "user", content }],
        text: { format: { type: "json_schema", name: "sugestoes_perfil", schema: suggestSchema, strict: true } },
      } as never);
      for (const o of (res as any).output ?? []) {
        if (o.type !== "message") continue;
        for (const c of o.content as { type: string; text?: string }[]) if (c.type === "output_text" && c.text) out += c.text;
      }
    } catch (e) {
      const status = (e as { status?: number }).status;
      console.error("suggestProfileFromDocument", status);
      return { ok: false as const, error: status === 402 ? "Os créditos de IA acabaram. Tente mais tarde." : status === 429 ? "Muitas leituras agora. Tente em alguns minutos." : "Não foi possível ler o documento agora." };
    }
    let raw: unknown;
    try { raw = JSON.parse(out); } catch { return { ok: false as const, error: "A leitura não retornou um resultado válido." }; }
    const rows = cleanSuggestions(raw).map((s) => ({ ...s, user_id: context.userId, source_document_id: doc.id }));
    if (!rows.length) return { ok: true as const, created: 0 };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("profile_suggestions").insert(rows as never);
    if (error) { console.error("suggestions insert", error.code); return { ok: false as const, error: "Não foi possível guardar as sugestões." }; }
    return { ok: true as const, created: rows.length };
  });

/** "Está certo, usar": só aqui uma sugestão entra no perfil, com origem "documento". */
export const acceptSuggestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), replace: z.boolean().default(false) }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: s } = await sb.from("profile_suggestions").select("*").eq("id", data.id).eq("user_id", context.userId).eq("status", "pending").maybeSingle();
    if (!s) return { ok: false as const, error: "Sugestão não encontrada ou já respondida." };
    const prev = await loadProfile(sb, context.userId);
    const result = applySuggestion(prev ?? emptyProfile, { field: s.field as SuggestionField, value: s.value }, data.replace);
    if (!result.ok) return { ok: false as const, error: result.error };
    const parsed = profileSchema.safeParse(result.profile);
    if (!parsed.success) return { ok: false as const, error: "Valor sugerido inválido." };
    await writeProfile(sb, context.userId, prev, parsed.data, { origem: "documento", ...(s.source_document_id ? { documento_id: s.source_document_id } : {}) });
    await sb.from("profile_suggestions").update({ status: "accepted" }).eq("id", s.id);
    return { ok: true as const };
  });

export const dismissSuggestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase.from("profile_suggestions").update({ status: "dismissed" }).eq("id", data.id).eq("user_id", context.userId);
    return { ok: true as const };
  });
