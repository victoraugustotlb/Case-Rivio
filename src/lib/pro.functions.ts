// Área do profissional (médico ou laboratório). Profissionais nunca leem dados do paciente direto:
// tudo passa por aqui, depois de validar o acesso com as regras puras de src/lib/clinic.ts.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { accessActive, canUpload, displayRequestStatus, endedState, patientRef, PRO_DOC_TYPES, type ProAccess } from "@/lib/clinic";
import { buildOpened, openDocumentForShare } from "@/lib/documents.functions";

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];
const admin = async (): Promise<Admin> => (await import("@/integrations/supabase/client.server")).supabaseAdmin;

export type ProIdentity = { role: "doctor" | "laboratory"; name: string; credential: string };

async function identity(sb: Admin, userId: string): Promise<ProIdentity> {
  const [{ data: d }, { data: l }] = await Promise.all([
    sb.from("doctor_profiles").select("full_name, crm, uf").eq("user_id", userId).maybeSingle(),
    sb.from("lab_profiles").select("legal_name, cnpj").eq("user_id", userId).maybeSingle(),
  ]);
  if (d) return { role: "doctor", name: d.full_name, credential: `CRM ${d.crm}/${d.uf} informado` };
  if (l) return { role: "laboratory", name: l.legal_name, credential: `CNPJ ${l.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")} informado` };
  throw new Error("Conta profissional não encontrada.");
}

type Req = { id: string; patient_id: string | null; status: string; expires_at: string; created_at: string; categories: string[]; signals: string[]; include_profile: boolean; period_months: number; request_upload: boolean; upload_granted: boolean; share_code_id: string | null; code: string; expected_patient_id: string | null };
type WithShare = Req & { share: { id: string; code: string; expires_at: string; revoked: boolean; created_at: string } | null };

async function loadRequests(sb: Admin, proId: string): Promise<WithShare[]> {
  const { data: reqs } = await sb.from("access_requests").select("*").eq("doctor_id", proId).order("created_at", { ascending: false }).limit(300);
  const ids = (reqs ?? []).map((r) => r.share_code_id).filter((x): x is string => !!x);
  const { data: shares } = ids.length ? await sb.from("share_codes").select("id, code, expires_at, revoked, created_at").in("id", ids) : { data: [] };
  const byId = new Map((shares ?? []).map((s) => [s.id, s]));
  return (reqs ?? []).map((r) => ({ ...(r as Req), share: r.share_code_id ? byId.get(r.share_code_id) ?? null : null }));
}
const asAccess = (r: WithShare): ProAccess => ({ status: r.status, upload_granted: r.upload_granted, share: r.share });

/** Acesso ativo mais recente do profissional a um paciente, ou null. */
async function activeAccess(sb: Admin, proId: string, patientId: string): Promise<WithShare | null> {
  const reqs = (await loadRequests(sb, proId)).filter((r) => r.patient_id === patientId && accessActive(asAccess(r)));
  return reqs[0] ?? null;
}

async function notify(sb: Admin, n: { user_id: string; kind: string; title: string; body?: string; link?: string; ref?: string }) {
  await sb.from("notifications").upsert({ body: "", ...n, ref: n.ref ?? crypto.randomUUID() }, { onConflict: "user_id,kind,ref", ignoreDuplicates: true });
}

export const getProIdentity = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .handler(async ({ context }) => identity(await admin(), context.userId));

/** Pacientes com acesso agora + histórico (sem nenhum dado de saúde). */
export const listProPatients = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = await admin();
    await identity(sb, context.userId);
    const reqs = (await loadRequests(sb, context.userId)).filter((r) => r.patient_id);
    const [{ data: links }, { data: logs }] = await Promise.all([
      sb.from("doctor_patients").select("patient_id, patient_name, patient_ref, last_seen_at").eq("doctor_id", context.userId),
      sb.from("access_logs").select("user_id, created_at").eq("viewer_id", context.userId).order("created_at", { ascending: false }).limit(500),
    ]);
    const lastLog = new Map<string, string>();
    for (const l of logs ?? []) if (!lastLog.has(l.user_id)) lastLog.set(l.user_id, l.created_at);
    const link = new Map((links ?? []).map((l) => [l.patient_id, l]));
    const ids = [...new Set([...reqs.map((r) => r.patient_id!), ...link.keys()])];
    const scope = (r: WithShare) => ({ categories: r.categories, signals: r.signals, includeProfile: r.include_profile, periodMonths: r.period_months, upload: r.upload_granted });
    const active = [], history = [];
    for (const id of ids) {
      const mine = reqs.filter((r) => r.patient_id === id);
      const name = link.get(id)?.patient_name ?? "Paciente";
      const ref = link.get(id)?.patient_ref ?? patientRef(id);
      const lastAccess = lastLog.get(id) ?? link.get(id)?.last_seen_at ?? null;
      const live = mine.find((r) => accessActive(asAccess(r)));
      if (live) { active.push({ patientId: id, name, ref, ...scope(live), canUpload: canUpload(asAccess(live)), expiresAt: live.share!.expires_at, lastAccess }); continue; }
      const latest = mine[0];
      const authorized = mine.filter((r) => r.status === "authorized");
      history.push({
        patientId: id, name, ref, state: latest ? endedState(asAccess(latest)) : "expirado",
        firstAt: authorized.at(-1)?.created_at ?? latest?.created_at ?? link.get(id)?.last_seen_at ?? null,
        lastAt: lastAccess, ...(latest ? scope(latest) : { categories: [], signals: [], includeProfile: false, periodMonths: 12, upload: false }),
      });
    }
    return { active: active.sort((a, b) => a.expiresAt.localeCompare(b.expiresAt)), history };
  });

export const listSentRequests = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = await admin();
    const reqs = (await loadRequests(sb, context.userId)).slice(0, 40);
    const { data: links } = await sb.from("doctor_patients").select("patient_id, patient_name, patient_ref").eq("doctor_id", context.userId);
    const link = new Map((links ?? []).map((l) => [l.patient_id, l]));
    return reqs.map((r) => {
      const pid = r.patient_id ?? r.expected_patient_id;
      const status = displayRequestStatus(r);
      return {
        id: r.id, status, createdAt: r.created_at, expiresAt: r.expires_at, code: status === "pending" ? r.code : null,
        patient: pid ? `${link.get(pid)?.patient_name ?? "Paciente"} · ${link.get(pid)?.patient_ref ?? patientRef(pid)}` : "Novo paciente",
        categories: r.categories, signals: r.signals, includeProfile: r.include_profile, periodMonths: r.period_months, requestUpload: r.request_upload, uploadGranted: r.upload_granted,
      };
    });
  });

/** Abre a visão clínica de um paciente com acesso ativo e registra a ação. */
export const openPatientHistory = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ patientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = await admin();
    const me = await identity(sb, context.userId);
    const a = await activeAccess(sb, context.userId, data.patientId);
    if (!a?.share) return { status: "sem_acesso" as const };
    const opened = await buildOpened(a.share.code, { viewerId: context.userId, action: "profissional_historico" });
    if (opened.status !== "valido") return { status: "sem_acesso" as const };
    await sb.from("doctor_patients").update({ last_seen_at: new Date().toISOString() }).eq("doctor_id", context.userId).eq("patient_id", data.patientId);
    await notify(sb, { user_id: data.patientId, kind: "historico_aberto", title: `${me.name} abriu seu histórico`, body: me.credential, link: "/acessos", ref: `${a.share.id}:${new Date().toISOString().slice(0, 13)}` });
    return { ...opened, canUpload: canUpload(asAccess(a)) };
  });

export const openPatientDocument = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ patientId: z.string().uuid(), documentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = await admin();
    const a = await activeAccess(sb, context.userId, data.patientId);
    if (!a?.share) return { status: "expirado" as const };
    return openDocumentForShare(a.share.code, data.documentId, context.userId);
  });

/** Pacientes para os quais este profissional pode enviar documentos agora. */
export const listUploadTargets = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = await admin();
    const me = await identity(sb, context.userId);
    const reqs = (await loadRequests(sb, context.userId)).filter((r) => r.patient_id && canUpload(asAccess(r)));
    const { data: links } = await sb.from("doctor_patients").select("patient_id, patient_name, patient_ref").eq("doctor_id", context.userId);
    const link = new Map((links ?? []).map((l) => [l.patient_id, l]));
    const seen = new Set<string>();
    const targets = reqs.filter((r) => !seen.has(r.patient_id!) && seen.add(r.patient_id!)).map((r) => ({
      patientId: r.patient_id!, name: link.get(r.patient_id!)?.patient_name ?? "Paciente", ref: link.get(r.patient_id!)?.patient_ref ?? patientRef(r.patient_id!), expiresAt: r.share!.expires_at,
    }));
    return { me, targets };
  });

const fieldSchema = z.object({ label: z.string().max(200), value: z.string().max(2000), ai_value: z.string().max(2000).optional(), excerpt: z.string().max(2000).optional(), confidence: z.enum(["alta", "media", "baixa"]).optional() });

/** Envia ao paciente um arquivo já colocado na pasta do próprio profissional. Fica aguardando aceitação. */
export const submitProDocument = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    patientId: z.string().uuid(), path: z.string().min(3).max(300), fileType: z.string().max(100),
    type: z.enum(PRO_DOC_TYPES.map((t) => t.id) as [string, ...string[]]), title: z.string().trim().min(1).max(200),
    docDate: z.string().max(20).optional(), note: z.string().max(2000).optional(), summary: z.string().max(1000).optional(), fields: z.array(fieldSchema).max(200),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = await admin();
    const me = await identity(sb, context.userId);
    if (!data.path.startsWith(`${context.userId}/`) || data.path.includes("..")) throw new Error("Arquivo inválido.");
    const a = await activeAccess(sb, context.userId, data.patientId);
    if (!a || !canUpload(asAccess(a))) throw new Error("Este paciente não liberou o envio de documentos, ou o acesso terminou.");
    const blob = (await sb.storage.from("medical-documents").download(data.path)).data;
    if (!blob) throw new Error("Arquivo não encontrado.");
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer())), (b) => b.toString(16).padStart(2, "0")).join("");
    const target = `${data.patientId}/${crypto.randomUUID()}.${data.path.split(".").pop()}`;
    const mv = await sb.storage.from("medical-documents").move(data.path, target);
    if (mv.error) throw new Error("Não foi possível guardar o arquivo.");
    const kind = PRO_DOC_TYPES.find((t) => t.id === data.type)!.kind;
    const { data: doc, error } = await sb.from("documents").insert({
      user_id: data.patientId, title: data.title, kind, doc_date: data.docDate || null, source: `${me.name} · ${me.credential}`,
      summary: data.summary || null, note: data.note || null, fields: data.fields, origin: "Enviado pelo profissional", file_path: target, file_type: data.fileType,
      file_hash: hash, confirmed: true, status: "pending_patient", uploaded_by: context.userId, uploaded_by_role: me.role, uploaded_by_name: me.name,
    }).select("id").single();
    if (error || !doc) { await sb.storage.from("medical-documents").remove([target]); throw new Error("Não foi possível enviar."); }
    await sb.from("access_logs").insert({ user_id: data.patientId, viewer_id: context.userId, share_code_id: a.share_code_id, action: "profissional_envio", document_id: doc.id });
    await notify(sb, { user_id: data.patientId, kind: "documento_pendente", title: "Documento aguardando sua aceitação", body: `${me.name} enviou “${data.title}”.`, link: "/documentos", ref: doc.id });
    return { ok: true };
  });

/** Só os documentos que o próprio profissional enviou, com o estado de cada um. */
export const listMyUploads = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = await admin();
    const { data } = await sb.from("documents").select("id, user_id, title, kind, status, created_at").eq("uploaded_by", context.userId).order("created_at", { ascending: false }).limit(100);
    const { data: links } = await sb.from("doctor_patients").select("patient_id, patient_name, patient_ref").eq("doctor_id", context.userId);
    const link = new Map((links ?? []).map((l) => [l.patient_id, l]));
    return (data ?? []).map((d) => ({ id: d.id, title: d.title, kind: d.kind, status: d.status, createdAt: d.created_at, patient: `${link.get(d.user_id)?.patient_name ?? "Paciente"} · ${link.get(d.user_id)?.patient_ref ?? patientRef(d.user_id)}` }));
  });

/** Agenda do profissional com cadastro em providers (consultas marcadas pelo VITA). */
export const getProAgenda = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: provs } = await context.supabase.from("providers").select("id, name").eq("user_id", context.userId);
    if (!provs?.length) return { hasProvider: false, items: [] as { id: string; startsAt: string; mode: string; status: string; coverage: string; provider: string }[] };
    const ids = provs.map((p) => p.id);
    const { data: appts } = await context.supabase.from("appointments").select("id, provider_id, slot_id, status, mode, coverage").in("provider_id", ids).order("created_at", { ascending: false }).limit(200);
    const slotIds = (appts ?? []).map((a) => a.slot_id);
    const { data: slots } = slotIds.length ? await context.supabase.from("availability_slots").select("id, starts_at").in("id", slotIds) : { data: [] };
    const st = new Map((slots ?? []).map((s) => [s.id, s.starts_at]));
    const pn = new Map(provs.map((p) => [p.id, p.name]));
    return { hasProvider: true, items: (appts ?? []).map((a) => ({ id: a.id, startsAt: st.get(a.slot_id) ?? "", mode: a.mode, status: a.status, coverage: a.coverage, provider: pn.get(a.provider_id) ?? "" })).sort((a, b) => a.startsAt.localeCompare(b.startsAt)) };
  });

export const hasProvider = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { count } = await context.supabase.from("providers").select("id", { count: "exact", head: true }).eq("user_id", context.userId);
    return (count ?? 0) > 0;
  });
