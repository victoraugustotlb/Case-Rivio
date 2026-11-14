import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { directoryFor } from "./provider-directory";
import { friendlyError, RADIUS_MAX, RADIUS_MIN } from "./scheduling";

const auth = requireSupabaseAuth;
type Ctx = { supabase: Parameters<typeof directoryFor>[0]; userId: string };

async function myPlan(ctx: Ctx) {
  const { data } = await ctx.supabase.from("plan_memberships").select("plan_id,status,insurance_plans(name)").eq("user_id", ctx.userId).maybeSingle();
  if (!data || data.status !== "active") return null;
  return { id: data.plan_id, name: (data.insurance_plans as { name: string } | null)?.name ?? "seu plano" };
}

const querySchema = z.object({
  specialty: z.string().max(80).optional(),
  mode: z.enum(["presencial", "telemedicina", "ambos"]),
  origin: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).nullable().optional(),
  city: z.string().max(80).nullable().optional(),
  radiusKm: z.number().min(RADIUS_MIN).max(RADIUS_MAX).nullable(),
  coverage: z.enum(["meu_plano", "particular", "todos"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  sort: z.enum(["distancia", "vaga", "preco"]),
});

export const getSchedulingOptions = createServerFn({ method: "POST" }).middleware([auth]).handler(async ({ context }) => {
  const dir = directoryFor(context.supabase);
  const [plan, specialties, cities] = await Promise.all([myPlan(context), dir.specialties(), dir.cities()]);
  return { plan, specialties, cities };
});

// A posição recebida é usada só para calcular distâncias nesta chamada; não é registrada.
export const searchDirectory = createServerFn({ method: "POST" }).middleware([auth])
  .inputValidator((d: unknown) => querySchema.parse(d))
  .handler(async ({ data, context }) => {
    const plan = await myPlan(context);
    const results = await directoryFor(context.supabase).search({ ...data, myPlanId: plan?.id ?? null });
    return { results, plan };
  });

export const getProviderDetail = createServerFn({ method: "POST" }).middleware([auth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const [plan, detail] = await Promise.all([myPlan(context), directoryFor(context.supabase).get(data.id)]);
    if (!detail) return null;
    return { ...detail, plan, acceptsMyPlan: !!plan && detail.provider.planIds.includes(plan.id) };
  });

export const bookAppointment = createServerFn({ method: "POST" }).middleware([auth])
  .inputValidator((d: unknown) => z.object({ slotId: z.string().uuid(), mode: z.enum(["presencial", "telemedicina"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: slot } = await context.supabase.from("availability_slots").select("provider_id").eq("id", data.slotId).maybeSingle();
    if (!slot) return { ok: false as const, error: "Horário não encontrado." };
    const plan = await myPlan(context);
    const { data: pp } = plan ? await context.supabase.from("provider_plans").select("plan_id").eq("provider_id", slot.provider_id).eq("plan_id", plan.id).maybeSingle() : { data: null };
    const { data: id, error } = await context.supabase.rpc("book_slot", { _slot: data.slotId, _mode: data.mode, _coverage: pp ? "plano" : "particular" });
    if (error) return { ok: false as const, error: friendlyError(error.message) };
    return { ok: true as const, id: id as string };
  });

export const listAppointments = createServerFn({ method: "POST" }).middleware([auth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.from("appointments")
    .select("id,status,mode,coverage,share_code_id,created_at,provider_id,providers(name,kind,specialties,address,city,uf,is_demo),availability_slots(id,starts_at,duration_min)")
    .eq("patient_id", context.userId).order("created_at", { ascending: false }).limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []).map((a) => ({
    id: a.id, status: a.status, mode: a.mode, coverage: a.coverage, shareCodeId: a.share_code_id, providerId: a.provider_id,
    provider: a.providers as { name: string; kind: string; specialties: string[]; address: string; city: string; uf: string; is_demo: boolean },
    startsAt: (a.availability_slots as { starts_at: string }).starts_at,
    durationMin: (a.availability_slots as { duration_min: number }).duration_min,
  }));
});

export const cancelAppointment = createServerFn({ method: "POST" }).middleware([auth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("cancel_appointment", { _id: data.id });
    return error ? { ok: false as const, error: friendlyError(error.message) } : { ok: true as const };
  });

export const rescheduleAppointment = createServerFn({ method: "POST" }).middleware([auth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), slotId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: id, error } = await context.supabase.rpc("reschedule_appointment", { _id: data.id, _new_slot: data.slotId });
    return error ? { ok: false as const, error: friendlyError(error.message) } : { ok: true as const, id: id as string };
  });

export const attachShareToAppointment = createServerFn({ method: "POST" }).middleware([auth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), code: z.string().max(12) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: s } = await context.supabase.from("share_codes").select("id").eq("code", data.code).maybeSingle();
    if (!s) return { ok: false as const };
    const { error } = await context.supabase.rpc("attach_appointment_share", { _id: data.id, _share: s.id });
    return { ok: !error };
  });

/** CEP → cidade (ViaCEP). Só a cidade é usada; nada é guardado. */
export const lookupCep = createServerFn({ method: "POST" }).middleware([auth])
  .inputValidator((d: unknown) => z.object({ cep: z.string().regex(/^\d{8}$/) }).parse(d))
  .handler(async ({ data }) => {
    try {
      const r = await fetch(`https://viacep.com.br/ws/${data.cep}/json/`);
      const j = (await r.json()) as { localidade?: string; uf?: string; erro?: boolean };
      if (!r.ok || j.erro || !j.localidade) return null;
      return { city: j.localidade, uf: j.uf ?? "" };
    } catch { return null; }
  });
