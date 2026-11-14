import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { canWriteRecords, membershipRules, normalizeCard, PLAN_MAX_ATTEMPTS, subscriptionState, type AccountType } from "./accounts";

type Sb = SupabaseClient<Database>;

async function loadAccount(sb: Sb, userId: string) {
  const [{ data: p }, { data: m }, { data: sub }] = await Promise.all([
    sb.from("profiles").select("account_type,billing_exempt").eq("user_id", userId).maybeSingle(),
    sb.from("plan_memberships").select("status,role,plan_id,insurance_plans(name)").eq("user_id", userId).maybeSingle(),
    sb.from("subscriptions").select("status,current_period_end,cancel_at_period_end").eq("user_id", userId).maybeSingle(),
  ]);
  const type = (p?.account_type ?? "patient_individual") as AccountType;
  const exempt = p?.billing_exempt ?? false;
  const planName = (m?.insurance_plans as { name: string } | null)?.name ?? null;
  return {
    type, exempt,
    membership: m ? { status: m.status, role: m.role, planName } : null,
    subscription: sub ? { ...sub, state: subscriptionState(sub) } : null,
    subscriptionState: subscriptionState(sub ?? null),
    canWrite: canWriteRecords({ type, exempt, membershipStatus: m?.status ?? null, sub: sub ?? null }),
  };
}

export const getAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => loadAccount(context.supabase, context.userId));

/** Paciente escolhe outro caminho (plano ↔ assinatura individual). Profissionais não mudam por aqui. */
export const choosePatientPath = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ type: z.enum(["patient_plan", "patient_individual"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: p } = await context.supabase.from("profiles").select("account_type").eq("user_id", context.userId).maybeSingle();
    if (p && p.account_type !== "patient_plan" && p.account_type !== "patient_individual") throw new Error("Contas profissionais não mudam de tipo.");
    if (p?.account_type === data.type) return { type: data.type };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Escolher outro caminho encerra a isenção de contas antigas.
    await supabaseAdmin.from("profiles").upsert({ user_id: context.userId, account_type: data.type, billing_exempt: false }, { onConflict: "user_id" });
    return { type: data.type };
  });

/** Profissional escolhe entre médico e laboratório no primeiro acesso. */
export const chooseProfessionalType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ type: z.enum(["doctor", "laboratory"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const [{ data: p }, { count: docs }] = await Promise.all([
      sb.from("profiles").select("account_type").eq("user_id", context.userId).maybeSingle(),
      sb.from("documents").select("id", { count: "exact", head: true }).eq("user_id", context.userId),
    ]);
    if (p?.account_type === data.type) return { type: data.type };
    if (p?.account_type === "doctor" || p?.account_type === "laboratory") throw new Error("Esta conta profissional já tem um tipo definido.");
    if ((docs ?? 0) > 0) throw new Error("Esta conta já guarda documentos de paciente. Crie uma conta profissional separada.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("profiles").upsert({ user_id: context.userId, account_type: data.type, billing_exempt: false }, { onConflict: "user_id" });
    return { type: data.type };
  });

export const listPlans = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => (await context.supabase.from("insurance_plans").select("id,name,is_demo").eq("active", true).order("name")).data ?? []);

/**
 * Ponto único de validação da carteirinha. Hoje confere formato e unicidade;
 * troque o corpo de `checkWithOperator` pela API da operadora quando houver.
 * Nunca envia dados de saúde: só operadora + carteirinha.
 */
async function checkWithOperator(_planId: string, _card: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  return { ok: true };
}

export const validatePlanMembership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    planId: z.string().uuid(),
    card: z.string().min(1).max(40),
    role: z.enum(["titular", "dependente"]),
    holderCard: z.string().max(40).nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 15 * 60_000).toISOString();
    const { count } = await supabaseAdmin.from("plan_attempts").select("id", { count: "exact", head: true }).eq("user_id", context.userId).gte("created_at", since);
    if ((count ?? 0) >= PLAN_MAX_ATTEMPTS) return { ok: false as const, error: "Muitas tentativas. Aguarde 15 minutos e tente de novo." };
    await supabaseAdmin.from("plan_attempts").insert({ user_id: context.userId });

    const rules = membershipRules(data.role, data.card, data.holderCard);
    if (rules.errors.length) return { ok: false as const, error: rules.errors.join(" ") };
    const card = normalizeCard(data.card);
    const { data: plan } = await supabaseAdmin.from("insurance_plans").select("id,active").eq("id", data.planId).maybeSingle();
    if (!plan?.active) return { ok: false as const, error: "Operadora indisponível." };
    const { data: taken } = await supabaseAdmin.from("plan_memberships").select("user_id").eq("plan_id", data.planId).eq("card_number", card).maybeSingle();
    if (taken && taken.user_id !== context.userId) return { ok: false as const, error: "Esta carteirinha já está vinculada a outra conta." };
    const op = await checkWithOperator(data.planId, card);
    if (!op.ok) return { ok: false as const, error: op.reason };

    const { data: p } = await supabaseAdmin.from("profiles").select("account_type").eq("user_id", context.userId).maybeSingle();
    if (p && p.account_type !== "patient_plan" && p.account_type !== "patient_individual") return { ok: false as const, error: "Contas profissionais não usam plano de saúde." };
    const { error } = await supabaseAdmin.from("plan_memberships").upsert({
      user_id: context.userId, plan_id: data.planId, card_number: card, role: data.role, holder_card_number: rules.holder, status: rules.status,
    }, { onConflict: "user_id" });
    if (error) return { ok: false as const, error: error.code === "23505" ? "Esta carteirinha já está vinculada a outra conta." : "Não foi possível salvar o vínculo." };
    await supabaseAdmin.from("profiles").upsert({ user_id: context.userId, account_type: "patient_plan", billing_exempt: false }, { onConflict: "user_id" });
    return { ok: true as const, status: rules.status };
  });

/**
 * Destino único depois do login, numa só ida ao servidor.
 * A intenção (plano/individual/médico/laboratório) só é aplicada no primeiro login com Google;
 * conta criada por e-mail já leva o tipo no cadastro, e login de conta existente nunca muda o tipo.
 */
export const resolveHome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ intent: z.enum(["patient_plan", "patient_individual", "doctor", "laboratory"]).nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    const { applyEntryIntent, destinationFor } = await import("./routing");
    const sb = context.supabase;
    let account = await loadAccount(sb, context.userId);
    if (data.intent) {
      // A intenção é só um bônus de conta nova: se esta consulta falhar, o login segue normalmente.
      let provider: string | null = null;
      let createdAt: string | null = null;
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: u } = await supabaseAdmin.auth.admin.getUserById(context.userId);
        provider = (u.user?.app_metadata?.["provider"] as string | undefined) ?? null;
        createdAt = u.user?.created_at ?? null;
      } catch (err) { console.error("[anamedis] intenção de entrada ignorada", err); }
      if (applyEntryIntent({ provider, createdAt })) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const current = account.type;
        const pro = (t: string) => t === "doctor" || t === "laboratory";
        const wantsPro = data.intent === "doctor" || data.intent === "laboratory";
        // Conta nova com Google: define o tipo escolhido. Profissional nunca vira paciente, e conta com documentos não vira profissional.
        const { count: docs } = await sb.from("documents").select("id", { count: "exact", head: true }).eq("user_id", context.userId);
        if (current !== data.intent && !pro(current) && (!wantsPro || (docs ?? 0) === 0)) {
          await supabaseAdmin.from("profiles").upsert({ user_id: context.userId, account_type: data.intent, billing_exempt: false }, { onConflict: "user_id" });
          account = await loadAccount(sb, context.userId);
        }
      }
    }
    const accountType = account.type;
    // Devolve a conta junto: o cliente põe no cache e /inicio não precisa buscá-la de novo.
    return { accountType, destino: destinationFor({ accountType, temVinculoPlano: !!account.membership }), account };
  });
