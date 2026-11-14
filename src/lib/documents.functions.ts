import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { docVisible, normalizeCode, accessState, profileVisible, essentialsVisible } from "@/lib/share";
import { filterEssentials, type EssentialEntry } from "@/lib/profile-completion";
import { parseProfileLenient, type HealthProfile } from "@/lib/profile";
import { LOOKUP_WINDOW_MIN, countsAsAttempt, lookupBlocked } from "@/lib/codes";

const extractSchema = {
  type: "object",
  additionalProperties: false,
  required: ["legivel", "titulo", "tipo", "data", "emissor", "resumo", "campos"],
  properties: {
    legivel: { type: "boolean", description: "false se não for um documento médico ou estiver ilegível" },
    titulo: { type: "string" },
    tipo: { type: "string", enum: ["Exame", "Laudo", "Consulta", "Receita", "Vacina"] },
    data: { type: "string", description: "Data do documento em DD/MM/AAAA, ou vazio" },
    emissor: { type: "string", description: "Laboratório, clínica ou médico (com CRM se houver)" },
    resumo: { type: "string", description: "Uma frase com o que o documento contém, sem interpretar ou diagnosticar" },
    campos: {
      type: "array",
      items: {
        type: "object", additionalProperties: false, required: ["rotulo", "valor", "trecho", "confianca"],
        properties: {
          rotulo: { type: "string" },
          valor: { type: "string", description: "Valor com unidade e faixa de referência quando houver" },
          trecho: { type: "string", description: "Trecho literal do original de onde o valor foi copiado" },
          confianca: { type: "string", enum: ["alta", "media", "baixa"], description: "Quão legível estava o trecho no original" },
        },
      },
    },
  },
} as const;

export type Extraction = { legivel: boolean; titulo: string; tipo: string; data: string; emissor: string; resumo: string; campos: { rotulo: string; valor: string; trecho: string; confianca: "alta" | "media" | "baixa" }[] };

export const extractDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ path: z.string().min(1).max(300) }).parse(d))
  .handler(async ({ data, context }): Promise<Extraction> => {
    if (!data.path.startsWith(`${context.userId}/`)) throw new Error("Arquivo não pertence a você.");
    const { data: blob, error } = await context.supabase.storage.from("medical-documents").download(data.path);
    if (error || !blob) throw new Error("Não foi possível abrir o arquivo enviado.");
    const mime = blob.type || (data.path.endsWith(".pdf") ? "application/pdf" : "image/jpeg");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    const dataUrl = `data:${mime};base64,${btoa(bin)}`;
    const filePart = mime === "application/pdf"
      ? { type: "input_file" as const, filename: "documento.pdf", file_data: dataUrl }
      : { type: "input_image" as const, image_url: dataUrl, detail: "high" as const };

    const { generateResponse } = await import("@lovable.dev/ai-gateway");
    const res = await generateResponse({
      model: "openai/gpt-6-astra",
      instructions:
        "Você transcreve documentos médicos brasileiros (exames laboratoriais, laudos de imagem, receitas, resumos de consulta, carteiras de vacina). " +
        "Copie fielmente o que está escrito: nomes de exames, resultados com unidade e valores de referência, medicamentos e posologia. " +
        "Nunca invente valores, nunca faça diagnóstico nem interprete se está normal além do que o próprio documento diz. Responda em português do Brasil.",
      input: [{ role: "user", content: [{ type: "input_text", text: "Extraia as informações deste documento em JSON." }, filePart] }],
      text: { format: { type: "json_schema", name: "documento_medico", schema: extractSchema, strict: true } },
    });
    let out = "";
    for (const o of res.output ?? []) {
      if (o.type !== "message") continue;
      for (const c of o.content as { type: string; text?: string }[]) if (c.type === "output_text" && c.text) out += c.text;
    }
    try {
      return JSON.parse(out) as Extraction;
    } catch {
      throw new Error("A leitura não retornou um resultado válido. Tente novamente.");
    }
  });

export type SharedField = { label: string; value: string; ai_value?: string; excerpt?: string; confidence?: "alta" | "media" | "baixa" };

async function sessionId(shareId: string): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`sessao:${shareId}`)));
  return `S-${Array.from(h.slice(0, 3), (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

async function loadValidShare(rawCode: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: share } = await supabaseAdmin.from("share_codes").select("*").eq("code", normalizeCode(rawCode)).maybeSingle();
  if (!share) return { admin: supabaseAdmin, share: null, state: "invalido" as const };
  return { admin: supabaseAdmin, share, state: accessState(new Date(share.expires_at), share.revoked) };
}

/** Hash do IP de quem digita o código (o IP puro nunca é guardado). */
async function callerIpHash(): Promise<string> {
  const { getRequestHeader } = await import("@tanstack/react-start/server");
  const ip = getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ?? getRequestHeader("x-real-ip") ?? "desconhecido";
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`vita-ip:${ip}`)));
  return Array.from(h, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Limite: 10 códigos inexistentes do mesmo IP bloqueiam por 15 minutos. Abrir um código válido nunca conta. */
async function withLookupLimit<T extends { status: string }>(run: () => Promise<T>): Promise<T | { status: "bloqueado" }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const ipHash = await callerIpHash();
  const since = new Date(Date.now() - LOOKUP_WINDOW_MIN * 60_000).toISOString();
  const { count } = await supabaseAdmin.from("share_lookup_attempts").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", since);
  if (lookupBlocked(count ?? 0)) return { status: "bloqueado" };
  const result = await run();
  if (countsAsAttempt(result.status !== "invalido")) await supabaseAdmin.from("share_lookup_attempts").insert({ ip_hash: ipHash });
  return result;
}

/** Verificação periódica: o médico só continua vendo enquanto o código for válido. */
export const checkShare = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ code: z.string().min(8).max(12) }).parse(d))
  .handler(async ({ data }) => withLookupLimit(async () => {
    const { share, state } = await loadValidShare(data.code);
    return { status: state, expiresAt: share?.expires_at ?? null };
  }));

/** Abre um documento autorizado: registra em access_logs e devolve um link novo e curto. */
export async function openDocumentForShare(code: string, documentId: string, viewerId?: string) {
  const { admin, share, state } = await loadValidShare(code);
  if (!share || state !== "valido") return { status: state === "valido" ? ("invalido" as const) : state };
  const { data: doc } = await admin.from("documents").select("id,kind,created_at,file_path,status").eq("id", documentId).eq("user_id", share.user_id).maybeSingle();
  if (!doc || !docVisible(doc, share)) return { status: "invalido" as const };
  await admin.from("access_logs").insert({ user_id: share.user_id, share_code_id: share.id, action: viewerId ? "profissional_documento" : "documento", document_id: doc.id, viewer_id: viewerId ?? null });
  let url: string | null = null;
  if (doc.file_path && doc.file_path.startsWith(`${share.user_id}/`)) url = (await admin.storage.from("medical-documents").createSignedUrl(doc.file_path, 120)).data?.signedUrl ?? null;
  return { status: "valido" as const, url };
}

export const openSharedDocument = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ code: z.string().min(8).max(12), documentId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => openDocumentForShare(data.code, data.documentId));

/** Monta a visão autorizada de um código. Com viewer, o registro identifica o profissional. */
export async function buildOpened(rawCode: string, viewer?: { viewerId: string; action: string }) {
  const code = normalizeCode(rawCode);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: share } = await supabaseAdmin.from("share_codes").select("*").eq("code", code).maybeSingle();
  if (!share) return { status: "invalido" as const };
  const state = accessState(new Date(share.expires_at), share.revoked);
  if (state !== "valido") return { status: state };
  const { data: rows } = await supabaseAdmin.from("documents").select("id,title,kind,doc_date,source,origin,file_path,file_type,file_hash,fields,summary,confirmed,created_at,status,uploaded_by_name").eq("user_id", share.user_id).eq("status", "accepted").order("created_at", { ascending: false });
  const docs = (rows ?? []).filter((d) => docVisible(d, share)).map((d) => ({ ...d, fields: (d.fields ?? []) as SharedField[], file_path: undefined, url: null as string | null }));
  let profile: HealthProfile | null = null;
  let profileIncomplete = false;
  if (profileVisible(share)) {
    const { data: profileRow, error: profileError } = await supabaseAdmin
      .from("patient_profiles")
      .select("full_name,birth_date,height_cm,weight_kg,medications,allergies,conditions,surgeries,family_history,smoking,alcohol,activity,questionnaire_completed")
      .eq("user_id", share.user_id)
      .maybeSingle();
    if (profileError) throw new Error("Não foi possível carregar o perfil autorizado.");
    if (profileRow) {
      const parsed = parseProfileLenient(profileRow);
      profile = parsed.profile; profileIncomplete = parsed.incomplete;
      if (parsed.incomplete) console.warn("openShare: perfil com campos fora do formato", parsed.invalid.join(","));
    }
  }
  await supabaseAdmin.from("access_logs").insert({ user_id: share.user_id, share_code_id: share.id, action: viewer?.action ?? "resumo", viewer_id: viewer?.viewerId ?? null });
  // Ficha essencial: só se o código a incluiu ao ser criado, e só os campos daquele momento.
  const essentialFields = essentialsVisible(share);
  let essentials: EssentialEntry[] | null = null;
  if (essentialFields.length) {
    const { data: row } = await supabaseAdmin.from("patient_profiles").select("*").eq("user_id", share.user_id).maybeSingle();
    essentials = filterEssentials(row ? parseProfileLenient(row).profile : null, essentialFields);
    await supabaseAdmin.from("access_logs").insert({ user_id: share.user_id, share_code_id: share.id, action: viewer ? "profissional_ficha" : "ficha", viewer_id: viewer?.viewerId ?? null });
  }
  const deviceSignals = await deviceSignalSummaries(supabaseAdmin, share);
  if (deviceSignals.length) await supabaseAdmin.from("access_logs").insert({ user_id: share.user_id, share_code_id: share.id, action: viewer ? "profissional_sinais" : "sinais", viewer_id: viewer?.viewerId ?? null });
  return { essentials, deviceSignals, status: "valido" as const, session: await sessionId(share.id), code, expiresAt: share.expires_at, categories: share.categories, signals: share.signals, periodMonths: share.period_months, includeProfile: profileVisible(share), profile, profileIncomplete, docs };
}

/** Acesso do médico: valida o código e devolve só o que o paciente autorizou. */
export const openShare = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ code: z.string().min(8).max(12) }).parse(d))
  .handler(async ({ data }) => withLookupLimit(() => buildOpened(data.code)));

/** Só os sinais autorizados, dentro do período, como resumo (nunca a série bruta). */
async function deviceSignalSummaries(admin: any, share: { user_id: string; signals: string[] | null; period_months: number }) {
  const { metricsForSignals, summarize, METRICS } = await import("@/lib/wearables");
  const metrics = metricsForSignals(share.signals ?? []);
  if (!metrics.length) return [];
  const now = new Date();
  const ms = share.period_months * 30.44 * 86_400_000;
  const since = new Date(now.getTime() - ms).toISOString();
  const out: { metric: string; label: string; unit: string; summary: NonNullable<ReturnType<typeof summarize>> }[] = [];
  for (const m of metrics) {
    const { data } = await admin.from("wearable_readings").select("metric,value,measured_at,source_device").eq("user_id", share.user_id).eq("metric", m).gte("measured_at", since).order("measured_at", { ascending: false }).limit(5000);
    const sum = summarize((data ?? []).map((r: any) => ({ ...r, value: Number(r.value) })), { now, ms });
    if (sum) out.push({ metric: m, label: METRICS[m].label, unit: METRICS[m].unit, summary: sum });
  }
  return out;
}
