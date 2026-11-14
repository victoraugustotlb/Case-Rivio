// Avisos do paciente, documentos enviados por profissionais e registro de acessos.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { accessNearExpiry } from "@/lib/clinic";

export const listNotifications = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // "Acesso perto de vencer": gerado na leitura, um aviso por código.
    const { data: shares } = await context.supabase.from("share_codes").select("id, expires_at, revoked").eq("revoked", false).gt("expires_at", new Date().toISOString());
    for (const s of shares ?? []) if (accessNearExpiry(s.expires_at)) {
      await supabaseAdmin.from("notifications").upsert({ user_id: context.userId, kind: "acesso_vencendo", title: "Acesso perto de vencer", body: `Um acesso ao seu histórico termina às ${new Date(s.expires_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}.`, link: "/compartilhar", ref: s.id }, { onConflict: "user_id,kind,ref", ignoreDuplicates: true });
    }
    const { data } = await context.supabase.from("notifications").select("id, kind, title, body, link, read_at, created_at").order("created_at", { ascending: false }).limit(30);
    return data ?? [];
  });

export const markNotificationsRead = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
    return { ok: true };
  });

export const listPendingUploads = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("documents").select("id, title, kind, doc_date, note, uploaded_by_name, source, created_at").eq("status", "pending_patient").order("created_at", { ascending: false });
    return data ?? [];
  });

/** Aceitar mantém o original; recusar apaga o arquivo e o profissional vê "recusado". */
export const respondUpload = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), accept: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: doc } = await context.supabase.from("documents").select("id, file_path, status").eq("id", data.id).eq("status", "pending_patient").maybeSingle();
    if (!doc) throw new Error("Documento não encontrado.");
    if (data.accept) {
      await context.supabase.from("documents").update({ status: "accepted" }).eq("id", doc.id);
      return { ok: true };
    }
    if (doc.file_path) await context.supabase.storage.from("medical-documents").remove([doc.file_path]);
    await context.supabase.from("documents").update({ status: "rejected", file_path: null, fields: [], summary: null, note: null }).eq("id", doc.id);
    return { ok: true };
  });

const ACTIONS: Record<string, string> = {
  resumo: "abriu seu histórico pelo código", documento: "abriu um documento pelo código",
  profissional_historico: "abriu seu histórico", profissional_documento: "abriu um documento", profissional_envio: "enviou um documento",
  familia_resumo: "viu seus documentos", familia_documento: "viu um documento seu",
};

export const listAccessLog = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: logs } = await context.supabase.from("access_logs").select("id, viewer_id, action, created_at").order("created_at", { ascending: false }).limit(100);
    const ids = [...new Set((logs ?? []).map((l) => l.viewer_id).filter((x): x is string => !!x))];
    const names = new Map<string, string>();
    if (ids.length) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const [{ data: docs }, { data: labs }] = await Promise.all([
        supabaseAdmin.from("doctor_profiles").select("user_id, full_name, crm, uf").in("user_id", ids),
        supabaseAdmin.from("lab_profiles").select("user_id, legal_name, cnpj").in("user_id", ids),
      ]);
      for (const d of docs ?? []) names.set(d.user_id, `${d.full_name} (CRM ${d.crm}/${d.uf} informado)`);
      for (const l of labs ?? []) names.set(l.user_id, `${l.legal_name} (CNPJ informado)`);
    }
    return (logs ?? []).map((l) => ({ id: l.id, who: l.viewer_id ? names.get(l.viewer_id) ?? "Familiar" : "Profissional com código", what: ACTIONS[l.action] ?? l.action, at: l.created_at }));
  });
