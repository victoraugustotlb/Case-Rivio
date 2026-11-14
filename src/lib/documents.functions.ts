import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { docVisible, normalizeCode, accessState, profileVisible } from "@/lib/share";
import { profileSchema, type HealthProfile } from "@/lib/profile";

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
        type: "object", additionalProperties: false, required: ["rotulo", "valor"],
        properties: { rotulo: { type: "string" }, valor: { type: "string", description: "Valor com unidade e faixa de referência quando houver" } },
      },
    },
  },
} as const;

export type Extraction = { legivel: boolean; titulo: string; tipo: string; data: string; emissor: string; resumo: string; campos: { rotulo: string; valor: string }[] };

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

/** Acesso do médico: valida o código e devolve só o que o paciente autorizou. */
export const openShare = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ code: z.string().min(8).max(12) }).parse(d))
  .handler(async ({ data }) => {
    const code = normalizeCode(data.code);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: share } = await supabaseAdmin.from("share_codes").select("*").eq("code", code).maybeSingle();
    if (!share) return { status: "invalido" as const };
    const state = accessState(new Date(share.expires_at), share.revoked);
    if (state !== "valido") return { status: state };
    const { data: rows } = await supabaseAdmin.from("documents").select("id,title,kind,doc_date,source,origin,file_path,fields,summary,confirmed,created_at").eq("user_id", share.user_id).order("created_at", { ascending: false });
    const docs = await Promise.all((rows ?? []).filter((d) => docVisible(d, share)).map(async (d) => {
      let url: string | null = null;
      if (d.file_path) url = (await supabaseAdmin.storage.from("medical-documents").createSignedUrl(d.file_path, 900)).data?.signedUrl ?? null;
      return { ...d, fields: (d.fields ?? []) as { label: string; value: string }[], file_path: undefined, url };
    }));
    let profile: HealthProfile | null = null;
    if (profileVisible(share)) {
      const { data: profileRow, error: profileError } = await supabaseAdmin
        .from("patient_profiles")
        .select("full_name,birth_date,height_cm,weight_kg,medications,allergies,conditions,surgeries,family_history,smoking,alcohol,activity,questionnaire_completed")
        .eq("user_id", share.user_id)
        .maybeSingle();
      if (profileError) throw new Error("Não foi possível carregar o perfil autorizado.");
      profile = profileRow ? profileSchema.parse(profileRow) : null;
    }
    return { status: "valido" as const, code, expiresAt: share.expires_at, categories: share.categories, signals: share.signals, periodMonths: share.period_months, includeProfile: profileVisible(share), profile, docs };
  });
