import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, FileClock, Loader2, X } from "lucide-react";
import { listNotifications, listPendingUploads, markNotificationsRead, respondUpload } from "@/lib/patient-inbox.functions";

/** Documentos enviados por profissionais aguardando a decisão do paciente. */
export function PendingUploads() {
  const list = useServerFn(listPendingUploads);
  const respond = useServerFn(respondUpload);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["pending-uploads"], queryFn: () => list() });
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  if (!q.data?.length) return null;
  const act = async (id: string, accept: boolean) => {
    if (!accept && !confirm("Recusar apaga o arquivo enviado. Continuar?")) return;
    setBusy(id); setErr("");
    try { await respond({ data: { id, accept } }); await Promise.all([qc.invalidateQueries({ queryKey: ["pending-uploads"] }), qc.invalidateQueries({ queryKey: ["documents"] })]); }
    catch (e) { setErr(e instanceof Error ? e.message : "Não foi possível responder."); } finally { setBusy(null); }
  };
  return (
    <section aria-labelledby="pend-up" className="rounded-2xl border border-warning/40 bg-warning-soft p-4">
      <h2 id="pend-up" className="flex items-center gap-2 font-semibold"><FileClock className="h-5 w-5 text-warning" aria-hidden />Aguardando sua aceitação</h2>
      <p className="mt-1 text-sm text-muted-foreground">Enquanto você não aceitar, o documento não entra no seu histórico nem em nenhum código de compartilhamento.</p>
      {err && <p role="alert" className="mt-2 text-sm text-destructive">{err}</p>}
      <ul className="mt-3 space-y-2">
        {q.data.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-card p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{d.title}</p>
              <p className="text-sm text-muted-foreground">Enviado por {d.uploaded_by_name} · {d.kind}{d.doc_date ? ` · ${d.doc_date}` : ""}</p>
              {d.note && <p className="mt-1 text-sm">Observação: {d.note}</p>}
            </div>
            <button disabled={busy === d.id} onClick={() => act(d.id, false)} className="inline-flex min-h-11 items-center gap-1 rounded-lg border bg-card px-3 text-sm font-semibold"><X className="h-4 w-4" aria-hidden />Recusar</button>
            <button disabled={busy === d.id} onClick={() => act(d.id, true)} className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground">{busy === d.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}Aceitar</button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function NotificationsCard() {
  const list = useServerFn(listNotifications);
  const mark = useServerFn(markNotificationsRead);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["notifications"], queryFn: () => list(), refetchInterval: 60_000 });
  const items = q.data ?? [];
  if (!items.length) return null;
  const unread = items.filter((n) => !n.read_at).length;
  return (
    <section aria-labelledby="avisos" className="rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id="avisos" className="flex items-center gap-2 font-semibold"><Bell className="h-5 w-5 text-primary" aria-hidden />Avisos{unread > 0 && <span className="rounded-full bg-primary px-2 text-xs text-primary-foreground">{unread}</span>}</h2>
        <div className="flex gap-3 text-sm">
          {unread > 0 && <button onClick={async () => { await mark(); qc.invalidateQueries({ queryKey: ["notifications"] }); }} className="text-muted-foreground underline">Marcar como lidos</button>}
          <Link to="/acessos" className="font-medium text-primary underline">Ver acessos</Link>
        </div>
      </div>
      <ul className="mt-2 divide-y">
        {items.slice(0, 5).map((n) => (
          <li key={n.id} className={`py-2 text-sm ${n.read_at ? "text-muted-foreground" : ""}`}>
            <p className="font-medium">{n.title}</p>
            {n.body && <p className="text-muted-foreground">{n.body}</p>}
            <p className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString("pt-BR")}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
