import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AUTHORIZED_HOURS, MAX_LOOKUPS, REQUEST_MINUTES, generateRequestCode, patientRef, requestOpen } from "@/lib/clinic";
import { PERIOD_OPTIONS, formatShareCode, validateShare } from "@/lib/share";

const scopeSchema = z.object({
  categories: z.array(z.enum(["exames", "laudos", "consultas", "receitas", "vacinas"])).max(5),
  signals: z.array(z.enum(["fc", "sono", "spo2", "passos", "pressao", "glicose"])).max(6),
  includeProfile: z.boolean(),
  periodMonths: z.number().refine((n) => (PERIOD_OPTIONS as readonly number[]).includes(n)),
  patientId: z.string().uuid().optional(),
});

export const createAccessRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => scopeSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: doctor } = await context.supabase.from("doctor_profiles").select("user_id").eq("user_id", context.userId).maybeSingle();
    if (!doctor) throw new Error("Conta profissional não encontrada.");
    const errs = validateShare({ ...data, validityHours: 1 });
    if (errs.length) throw new Error(errs[0]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.patientId) {
      const { data: link } = await supabaseAdmin.from("doctor_patients").select("patient_id").eq("doctor_id", context.userId).eq("patient_id", data.patientId).maybeSingle();
      if (!link) throw new Error("Paciente não está no seu histórico.");
    }
    await supabaseAdmin.from("access_requests").update({ status: "expired" }).eq("status", "pending").lt("expires_at", new Date().toISOString());
    for (let i = 0; i < 5; i++) {
      const code = generateRequestCode();
      const { data: row, error } = await supabaseAdmin.from("access_requests").insert({
        doctor_id: context.userId, code, categories: data.categories, signals: data.signals, include_profile: data.includeProfile,
        period_months: data.periodMonths, expected_patient_id: data.patientId ?? null,
        expires_at: new Date(Date.now() + REQUEST_MINUTES * 60_000).toISOString(),
      }).select("id, code, expires_at").single();
      if (!error && row) return row;
    }
    throw new Error("Não foi possível gerar o código. Tente novamente.");
  });

export const getAccessRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: r } = await context.supabase.from("access_requests").select("id, status, expires_at, share_code_id").eq("id", data.id).maybeSingle();
    if (!r) throw new Error("Solicitação não encontrada.");
    const status = r.status === "pending" && !requestOpen(r) ? "expired" : r.status;
    if (status !== "authorized" || !r.share_code_id) return { status, shareCode: null as string | null };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: s } = await supabaseAdmin.from("share_codes").select("code").eq("id", r.share_code_id).maybeSingle();
    return { status, shareCode: s?.code ?? null };
  });

async function findOpenRequest(code: string, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const since = new Date(Date.now() - 15 * 60_000).toISOString();
  const { count } = await supabaseAdmin.from("request_attempts").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", since);
  if ((count ?? 0) >= MAX_LOOKUPS) throw new Error("Muitas tentativas. Aguarde 15 minutos e tente de novo.");
  await supabaseAdmin.from("request_attempts").insert({ user_id: userId });
  const { data: r } = await supabaseAdmin.from("access_requests").select("*").eq("code", code).eq("status", "pending").maybeSingle();
  if (!r || !requestOpen(r) || (r.expected_patient_id && r.expected_patient_id !== userId)) return { supabaseAdmin, r: null };
  return { supabaseAdmin, r };
}

const codeSchema = z.object({ code: z.string().regex(/^[0-9]{6}$/) });

export const lookupAccessRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => codeSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, r } = await findOpenRequest(data.code, context.userId);
    if (!r) return null;
    const { data: doc } = await supabaseAdmin.from("doctor_profiles").select("full_name, crm, uf, specialty").eq("user_id", r.doctor_id).maybeSingle();
    return {
      doctor: doc ?? { full_name: "Profissional", crm: "", uf: "", specialty: "" },
      categories: r.categories, signals: r.signals, includeProfile: r.include_profile, periodMonths: r.period_months, expiresAt: r.expires_at,
    };
  });

export const respondAccessRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => codeSchema.extend({ accept: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, r } = await findOpenRequest(data.code, context.userId);
    if (!r) throw new Error("Código não encontrado ou expirado.");
    if (r.doctor_id === context.userId) throw new Error("Você não pode autorizar a própria solicitação.");
    if (!data.accept) {
      await supabaseAdmin.from("access_requests").update({ status: "declined", patient_id: context.userId }).eq("id", r.id).eq("status", "pending");
      return { ok: true };
    }
    const { data: share, error } = await supabaseAdmin.from("share_codes").insert({
      user_id: context.userId, code: formatShareCode(), categories: r.categories, signals: r.signals, include_profile: r.include_profile,
      period_months: r.period_months, expires_at: new Date(Date.now() + AUTHORIZED_HOURS * 3600_000).toISOString(),
    }).select("id").single();
    if (error || !share) throw new Error("Não foi possível liberar o acesso.");
    const { data: upd } = await supabaseAdmin.from("access_requests").update({ status: "authorized", patient_id: context.userId, share_code_id: share.id }).eq("id", r.id).eq("status", "pending").select("id");
    if (!upd?.length) { await supabaseAdmin.from("share_codes").update({ revoked: true }).eq("id", share.id); throw new Error("Solicitação já respondida."); }
    const { data: prof } = await supabaseAdmin.from("patient_profiles").select("full_name").eq("user_id", context.userId).maybeSingle();
    const meta = (context.claims as { user_metadata?: { full_name?: string } }).user_metadata;
    await supabaseAdmin.from("doctor_patients").upsert({
      doctor_id: r.doctor_id, patient_id: context.userId, patient_name: prof?.full_name || meta?.full_name || "Paciente",
      patient_ref: patientRef(context.userId), last_seen_at: new Date().toISOString(),
    }, { onConflict: "doctor_id,patient_id" });
    return { ok: true };
  });
