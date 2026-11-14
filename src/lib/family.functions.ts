// Todo acesso entre familiares passa por aqui. Ninguém lê dados de outra pessoa por SELECT direto:
// as leituras cruzadas usam o cliente administrativo só depois de canViewMember permitir.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeCard, isCardNumber } from "./accounts";
import { ageFromBirthDate, profileSchema } from "./profile";
import { canShareFor, canViewMember, decideFamilyRequest, familyKey, findHolder, grantExpiry, kindAllowed, resolveFamily, type FamilyGrant, type FamilyMember, type FamilyMembership } from "./family";
import { formatShareCode, validateShare } from "./share";

const auth = requireSupabaseAuth;
async function admin() { return (await import("@/integrations/supabase/client.server")).supabaseAdmin; }
type Admin = Awaited<ReturnType<typeof admin>>;

async function names(sb: Admin, ids: string[]) {
  const out = new Map<string, { name: string; birth: string | null }>();
  if (!ids.length) return out;
  const { data } = await sb.from("patient_profiles").select("user_id,full_name,birth_date").in("user_id", ids);
  for (const p of data ?? []) out.set(p.user_id, { name: p.full_name ?? "", birth: p.birth_date ?? null });
  for (const id of ids) {
    if (out.get(id)?.name) continue;
    const { data: u } = await sb.auth.admin.getUserById(id);
    const meta = u.user?.user_metadata as Record<string, unknown> | undefined;
    out.set(id, { name: (meta?.["full_name"] as string) || (meta?.["name"] as string) || "Familiar", birth: out.get(id)?.birth ?? null });
  }
  return out;
}

async function loadFamily(sb: Admin, userId: string) {
  const { data: mine } = await sb.from("plan_memberships").select("user_id,plan_id,card_number,role,holder_card_number,status,created_at").eq("user_id", userId).maybeSingle();
  if (!mine) return null;
  const key = familyKey(mine as FamilyMembership);
  if (!key) return { mine: mine as FamilyMembership, rows: [] as FamilyMembership[], key: null };
  const { data: rows } = await sb.from("plan_memberships").select("user_id,plan_id,card_number,role,holder_card_number,status,created_at")
    .eq("plan_id", mine.plan_id).eq("status", "active").or(`card_number.eq.${key},holder_card_number.eq.${key}`);
  const f = resolveFamily((rows ?? []) as FamilyMembership[], mine.plan_id, key);
  return { mine: mine as FamilyMembership, rows: [f.holder, ...f.dependents].filter(Boolean) as FamilyMembership[], key };
}

const asMember = (m: FamilyMembership, birth: string | null): FamilyMember => ({ id: m.user_id, role: m.role, planId: m.plan_id, familyKey: familyKey(m), birthDate: birth });

/** Decide se `viewerId` pode ver `ownerId`, com dados frescos do banco. */
async function decide(sb: Admin, viewerId: string, ownerId: string) {
  const fam = await loadFamily(sb, viewerId);
  const ownerRow = fam?.rows.find((r) => r.user_id === ownerId);
  const viewerRow = fam?.rows.find((r) => r.user_id === viewerId);
  if (!fam || !ownerRow || !viewerRow) return { decision: { allowed: false as const, reason: "outra_familia" as const }, info: null };
  const info = await names(sb, [viewerId, ownerId]);
  const { data: g } = await sb.from("family_access_grants").select("*").eq("owner_id", ownerId).eq("viewer_id", viewerId).eq("basis", "consentimento").order("created_at", { ascending: false }).limit(1).maybeSingle();
  const decision = canViewMember(asMember(viewerRow, info.get(viewerId)?.birth ?? null), asMember(ownerRow, info.get(ownerId)?.birth ?? null), (g as FamilyGrant | null) ?? null);
  return { decision, info };
}

export const getFamily = createServerFn({ method: "POST" }).middleware([auth]).handler(async ({ context }) => {
  const sb = await admin();
  const me = context.userId;
  const fam = await loadFamily(sb, me);
  const { data: plan } = fam ? await sb.from("insurance_plans").select("id,name").eq("id", fam.mine.plan_id).maybeSingle() : { data: null };
  const [{ data: myReqs }, { data: incoming }, { data: grantsOut }, { data: grantsIn }] = await Promise.all([
    sb.from("family_requests").select("id,status,created_at,holder_card_number").eq("requester_id", me).order("created_at", { ascending: false }).limit(1),
    sb.from("family_requests").select("id,requester_id,created_at").eq("holder_id", me).eq("status", "pendente"),
    sb.from("family_access_grants").select("*").eq("viewer_id", me),
    sb.from("family_access_grants").select("*").eq("owner_id", me).in("status", ["pendente", "ativo"]),
  ]);
  const requesterIds = (incoming ?? []).map((r) => r.requester_id);
  const { data: reqCards } = requesterIds.length ? await sb.from("plan_memberships").select("user_id,card_number").in("user_id", requesterIds) : { data: [] };
  const ids = [...new Set([...(fam?.rows.map((r) => r.user_id) ?? []), ...requesterIds, ...(grantsIn ?? []).map((g) => g.viewer_id)])];
  const info = await names(sb, ids);
  const meRow = fam?.rows.find((r) => r.user_id === me);
  const members = (fam?.rows ?? []).map((r) => {
    let access: "voce" | "ver" | "pedir" | "aguardando" = "voce";
    if (r.user_id !== me && meRow) {
      const g = (grantsOut ?? []).filter((x) => x.owner_id === r.user_id).sort((a, b) => b.created_at.localeCompare(a.created_at))[0] as FamilyGrant | undefined;
      const d = canViewMember(asMember(meRow, info.get(me)?.birth ?? null), asMember(r, info.get(r.user_id)?.birth ?? null), g ?? null);
      access = d.allowed ? "ver" : d.reason === "pendente" ? "aguardando" : "pedir";
    }
    return { id: r.user_id, name: info.get(r.user_id)?.name || "Familiar", role: r.role, age: ageFromBirthDate(info.get(r.user_id)?.birth ?? null), since: r.created_at ?? null, access };
  });
  const activeGrants = (grantsIn ?? []).filter((g) => g.status === "ativo" && (!g.expires_at || new Date(g.expires_at) > new Date()));
  const { data: logs } = await context.supabase.from("access_logs").select("viewer_id,action,created_at").eq("user_id", me).not("viewer_id", "is", null).order("created_at", { ascending: false }).limit(20);
  const logNames = await names(sb, [...new Set((logs ?? []).map((l) => l.viewer_id!).filter((id) => !info.has(id)))]);
  return {
    planName: plan?.name ?? null, planId: fam?.mine.plan_id ?? null,
    myRole: fam?.mine.role ?? null, myStatus: fam?.mine.status ?? null, connected: !!fam?.key,
    lastRequest: myReqs?.[0] ? { status: myReqs[0].status, createdAt: myReqs[0].created_at } : null,
    members,
    incomingRequests: (incoming ?? []).map((r) => ({ id: r.id, name: info.get(r.requester_id)?.name || "Familiar", card: reqCards?.find((c) => c.user_id === r.requester_id)?.card_number ?? "", createdAt: r.created_at })),
    accessRequests: (grantsIn ?? []).filter((g) => g.status === "pendente").map((g) => ({ id: g.id, name: info.get(g.viewer_id)?.name || "Familiar", createdAt: g.created_at })),
    grantsGiven: activeGrants.map((g) => ({ id: g.id, name: info.get(g.viewer_id)?.name || "Familiar", scope: g.scope, categories: g.categories, expiresAt: g.expires_at })),
    accessLog: (logs ?? []).map((l) => ({ name: info.get(l.viewer_id!)?.name || logNames.get(l.viewer_id!)?.name || "Familiar", action: l.action, at: l.created_at })),
  };
});

export const requestFamilyLink = createServerFn({ method: "POST" }).middleware([auth])
  .inputValidator((d: unknown) => z.object({ planId: z.string().uuid(), holderCard: z.string().min(1).max(40) }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = await admin();
    const holderCard = normalizeCard(data.holderCard);
    if (!isCardNumber(holderCard)) return { ok: false as const, error: "Número da carteirinha do titular inválido: use de 8 a 20 dígitos." };
    const since = new Date(Date.now() - 15 * 60_000).toISOString();
    const { count } = await sb.from("plan_attempts").select("id", { count: "exact", head: true }).eq("user_id", context.userId).gte("created_at", since);
    if ((count ?? 0) >= 5) return { ok: false as const, error: "Muitas tentativas. Aguarde 15 minutos e tente de novo." };
    await sb.from("plan_attempts").insert({ user_id: context.userId });
    const { data: mine } = await sb.from("plan_memberships").select("plan_id,card_number,role,status").eq("user_id", context.userId).maybeSingle();
    if (!mine || mine.plan_id !== data.planId) return { ok: false as const, error: "Vincule primeiro a sua carteirinha desta operadora." };
    if (mine.role === "titular" && mine.status === "active") return { ok: false as const, error: "Você é titular do plano: os dependentes é que pedem para se conectar." };
    if (mine.card_number === holderCard) return { ok: false as const, error: "Informe a carteirinha do titular, não a sua." };
    const { data: pend } = await sb.from("family_requests").select("id").eq("requester_id", context.userId).eq("status", "pendente").maybeSingle();
    if (pend) return { ok: false as const, error: "Você já tem um pedido aguardando o titular." };
    const { data: rows } = await sb.from("plan_memberships").select("user_id,plan_id,card_number,role,holder_card_number,status").eq("plan_id", data.planId).eq("card_number", holderCard);
    const holder = findHolder((rows ?? []) as FamilyMembership[], data.planId, holderCard);
    // Mesmo sem titular encontrado o pedido é criado — a resposta não revela se a carteirinha existe.
    await sb.from("family_requests").insert({ requester_id: context.userId, plan_id: data.planId, holder_card_number: holderCard, holder_id: holder?.user_id ?? null });
    return { ok: true as const };
  });

export const respondFamilyRequest = createServerFn({ method: "POST" }).middleware([auth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), approve: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = await admin();
    const { data: req } = await sb.from("family_requests").select("*").eq("id", data.id).maybeSingle();
    if (!req) return { ok: false as const, error: "Pedido não encontrado." };
    const d = decideFamilyRequest(req, context.userId, data.approve);
    if (!d.ok) return d;
    const { data: holder } = await sb.from("plan_memberships").select("plan_id,card_number,role,status").eq("user_id", context.userId).maybeSingle();
    if (!holder || holder.role !== "titular" || holder.status !== "active" || holder.card_number !== req.holder_card_number || holder.plan_id !== req.plan_id) return { ok: false as const, error: "Seu vínculo de titular não confere com o pedido." };
    await sb.from("family_requests").update({ status: d.status, decided_at: new Date().toISOString() }).eq("id", req.id).eq("status", "pendente");
    if (d.status === "aprovado") {
      await sb.from("plan_memberships").update({ role: "dependente", holder_card_number: req.holder_card_number, status: "active" }).eq("user_id", req.requester_id).eq("plan_id", req.plan_id);
    }
    return { ok: true as const };
  });

export const requestMemberAccess = createServerFn({ method: "POST" }).middleware([auth])
  .inputValidator((d: unknown) => z.object({ memberId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = await admin();
    const { decision } = await decide(sb, context.userId, data.memberId);
    if (decision.allowed) return { ok: true as const };
    if (decision.reason === "outra_familia") return { ok: false as const, error: "Esta pessoa não faz parte da sua família no plano." };
    if (decision.reason === "pendente") return { ok: true as const };
    await sb.from("family_access_grants").insert({ owner_id: data.memberId, viewer_id: context.userId, status: "pendente", basis: "consentimento" });
    return { ok: true as const };
  });

export const respondMemberAccess = createServerFn({ method: "POST" }).middleware([auth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(), approve: z.boolean(),
    scope: z.enum(["tudo", "categorias"]).default("tudo"),
    categories: z.array(z.enum(["Exame", "Laudo", "Consulta", "Receita", "Vacina"])).max(5).default([]),
    duration: z.enum(["30d", "6m", "sem_prazo"]).default("30d"),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = await admin();
    const { data: g } = await sb.from("family_access_grants").select("id,owner_id,status").eq("id", data.id).maybeSingle();
    if (!g || g.owner_id !== context.userId || g.status !== "pendente") return { ok: false as const, error: "Pedido não encontrado ou já respondido." };
    if (data.approve && data.scope === "categorias" && data.categories.length === 0) return { ok: false as const, error: "Escolha ao menos uma categoria." };
    await sb.from("family_access_grants").update(data.approve
      ? { status: "ativo", scope: data.scope, categories: data.scope === "tudo" ? [] : data.categories, expires_at: grantExpiry(data.duration) }
      : { status: "recusado" }).eq("id", g.id);
    return { ok: true as const };
  });

export const revokeMemberAccess = createServerFn({ method: "POST" }).middleware([auth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = await admin();
    await sb.from("family_access_grants").update({ status: "revogado", revoked_at: new Date().toISOString() }).eq("id", data.id).eq("owner_id", context.userId);
    return { ok: true as const };
  });

export const getMemberRecords = createServerFn({ method: "POST" }).middleware([auth])
  .inputValidator((d: unknown) => z.object({ memberId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = await admin();
    const { decision, info } = await decide(sb, context.userId, data.memberId);
    const name = info?.get(data.memberId)?.name || "Familiar";
    if (!decision.allowed || decision.basis === "proprio") return { allowed: false as const, name, reason: decision.allowed ? "proprio" : decision.reason };
    const [{ data: docs }, { data: prof }] = await Promise.all([
      sb.from("documents").select("id,title,kind,doc_date,source,summary,fields,created_at,file_type").eq("user_id", data.memberId).order("created_at", { ascending: false }),
      decision.scope === "tudo" ? sb.from("patient_profiles").select("*").eq("user_id", data.memberId).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    await sb.from("access_logs").insert({ user_id: data.memberId, viewer_id: context.userId, action: "familia_resumo" });
    const parsed = prof ? profileSchema.safeParse({ ...prof, medications: prof.medications ?? [] }) : null;
    return {
      allowed: true as const, name, basis: decision.basis, canWrite: decision.canWrite, canShare: canShareFor(decision),
      scope: decision.scope, categories: decision.categories, age: ageFromBirthDate(info?.get(data.memberId)?.birth ?? null),
      documents: (docs ?? []).filter((d) => kindAllowed(decision, d.kind)),
      profile: parsed?.success ? parsed.data : null,
    };
  });

export const openMemberDocument = createServerFn({ method: "POST" }).middleware([auth])
  .inputValidator((d: unknown) => z.object({ memberId: z.string().uuid(), documentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = await admin();
    const { decision } = await decide(sb, context.userId, data.memberId);
    if (!decision.allowed || decision.basis === "proprio") return { ok: false as const, error: "Acesso não autorizado." };
    const { data: doc } = await sb.from("documents").select("id,kind,file_path").eq("id", data.documentId).eq("user_id", data.memberId).maybeSingle();
    if (!doc || !kindAllowed(decision, doc.kind) || !doc.file_path?.startsWith(`${data.memberId}/`)) return { ok: false as const, error: "Documento não autorizado." };
    const { data: url } = await sb.storage.from("medical-documents").createSignedUrl(doc.file_path, 120);
    await sb.from("access_logs").insert({ user_id: data.memberId, viewer_id: context.userId, action: "familia_documento", document_id: doc.id });
    return { ok: true as const, url: url?.signedUrl ?? null };
  });

/** Responsável legal salva um documento no histórico do menor. O arquivo é movido da pasta de quem enviou para a do menor. */
export const saveMinorDocument = createServerFn({ method: "POST" }).middleware([auth])
  .inputValidator((d: unknown) => z.object({
    memberId: z.string().uuid(), path: z.string().min(1).max(300), fileType: z.string().max(80), fileHash: z.string().max(128), origin: z.string().max(40),
    title: z.string().max(200), kind: z.enum(["Exame", "Laudo", "Consulta", "Receita", "Vacina"]), docDate: z.string().max(20).nullable(), source: z.string().max(200).nullable(), summary: z.string().max(2000).nullable(),
    fields: z.array(z.object({ label: z.string().max(200), value: z.string().max(1000), ai_value: z.string().max(1000).optional(), excerpt: z.string().max(2000).optional(), confidence: z.string().max(10).optional() })).max(200),
  }).parse(d))
  .handler(async ({ data, context }) => {
    if (!data.path.startsWith(`${context.userId}/`)) return { ok: false as const, error: "Arquivo inválido." };
    const sb = await admin();
    const { decision } = await decide(sb, context.userId, data.memberId);
    if (!decision.allowed || decision.basis !== "responsavel_legal") return { ok: false as const, error: "Só o responsável legal pode enviar documentos para este perfil." };
    const { data: can } = await sb.rpc("can_write_records", { _uid: context.userId });
    if (!can) return { ok: false as const, error: "Seu acesso não permite enviar documentos agora." };
    const target = `${data.memberId}/${crypto.randomUUID()}.${data.path.split(".").pop()}`;
    const mv = await sb.storage.from("medical-documents").move(data.path, target);
    if (mv.error) return { ok: false as const, error: "Não foi possível guardar o arquivo." };
    const { error } = await sb.from("documents").insert({
      user_id: data.memberId, title: data.title || "Documento sem título", kind: data.kind, doc_date: data.docDate || null, source: data.source || null,
      summary: data.summary || null, fields: data.fields, origin: data.origin, file_path: target, file_type: data.fileType, file_hash: data.fileHash, confirmed: true,
    });
    if (error) return { ok: false as const, error: "Não foi possível salvar." };
    return { ok: true as const };
  });

/** Código para médico em nome de um menor: só o responsável legal. Adultos geram o próprio. */
export const createMinorShareCode = createServerFn({ method: "POST" }).middleware([auth])
  .inputValidator((d: unknown) => z.object({
    memberId: z.string().uuid(),
    categories: z.array(z.enum(["exames", "laudos", "consultas", "receitas", "vacinas"])).max(5),
    signals: z.array(z.enum(["fc", "sono", "spo2", "passos", "pressao", "glicose"])).max(6),
    includeProfile: z.boolean(), periodMonths: z.number().int(), validityHours: z.number().int(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const errs = validateShare({ categories: data.categories, signals: data.signals, includeProfile: data.includeProfile, periodMonths: data.periodMonths, validityHours: data.validityHours } as never);
    if (errs.length) return { ok: false as const, error: errs[0]! };
    const sb = await admin();
    const { decision } = await decide(sb, context.userId, data.memberId);
    if (!canShareFor(decision) || (decision.allowed && decision.basis === "proprio")) return { ok: false as const, error: "Só o responsável legal de um menor gera código para o perfil dele." };
    const { data: can } = await sb.rpc("can_write_records", { _uid: context.userId });
    if (!can) return { ok: false as const, error: "Seu acesso não permite gerar códigos agora." };
    for (let i = 0; i < 3; i++) {
      const code = formatShareCode();
      const { error } = await sb.from("share_codes").insert({ user_id: data.memberId, code, categories: data.categories, signals: data.signals, include_profile: data.includeProfile, period_months: data.periodMonths, expires_at: new Date(Date.now() + data.validityHours * 3600_000).toISOString() });
      if (!error) return { ok: true as const, code };
      if (error.code !== "23505") break;
    }
    return { ok: false as const, error: "Não foi possível gerar o código. Tente novamente." };
  });
