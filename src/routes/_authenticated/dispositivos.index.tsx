import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { AlertTriangle, BarChart3, CheckCircle2, Clock, Download, ExternalLink, KeyRound, Loader2, Smartphone, Trash2, Unplug, Watch } from "lucide-react";
import { AppShell, PageTitle } from "@/components/vita/AppShell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { LiveHeartRate } from "@/components/vita/LiveHeartRate";
import { WearablePanel } from "@/components/vita/WearablePanel";
import { connectionsQuery, useReadingsRealtime, type ConnectionRow } from "@/lib/wearables-query";
import { demoReadings } from "@/lib/wearables-demo";
import { connectionStatusText, SOURCES, type Source } from "@/lib/wearables";
import { deleteAllWearableData, deleteConnectionData, exportWearableCsv, revokeConnection, startAggregatorConnection, wearableProviderStatus } from "@/lib/wearables.functions";

export const Route = createFileRoute("/_authenticated/dispositivos/")({
  validateSearch: (s: Record<string, unknown>) => z.object({ demo: z.coerce.number().optional() }).catch({}).parse(s),
  head: () => ({
    meta: [
      { title: "Dispositivos — Anamedis" },
      { name: "description", content: "Conecte relógio, anel, cinta cardíaca ou outro aplicativo ao seu histórico de saúde." },
      { property: "og:title", content: "Dispositivos — Anamedis" },
      { property: "og:description", content: "Conexões de dispositivos com consentimento e controle total." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dispositivos,
});

type AggSource = Exclude<Source, "ble_hr" | "outro">;
const AGG: { id: AggSource; hint: string }[] = [
  { id: "apple_health", hint: "Pelo app Saúde do iPhone" },
  { id: "health_connect", hint: "Android, pelo app de pareamento" },
  { id: "garmin", hint: "Autorização no site da Garmin" },
  { id: "fitbit", hint: "Autorização na conta Google/Fitbit" },
  { id: "oura", hint: "Autorização no site da Oura" },
  { id: "whoop", hint: "Autorização no site da Whoop" },
  { id: "polar", hint: "Autorização no site da Polar" },
];
const CONSENT_METRICS = "frequência cardíaca, FC em repouso, variabilidade da FC, oxigenação (SpO₂), passos, sono, pressão arterial, glicose, peso e temperatura";

function StatusIcon({ c }: { c: ConnectionRow }) {
  if (c.status === "error") return <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden />;
  if (c.status === "pending") return <Clock className="h-5 w-5 text-warning" aria-hidden />;
  if (c.status === "revoked") return <Unplug className="h-5 w-5 text-muted-foreground" aria-hidden />;
  const stale = !c.last_sync_at || Date.now() - new Date(c.last_sync_at).getTime() > 86_400_000;
  return stale ? <AlertTriangle className="h-5 w-5 text-warning" aria-hidden /> : <CheckCircle2 className="h-5 w-5 text-success" aria-hidden />;
}

function Dispositivos() {
  const { demo } = Route.useSearch();
  useReadingsRealtime();
  const qc = useQueryClient();
  const conns = useQuery(connectionsQuery);
  const statusFn = useServerFn(wearableProviderStatus);
  const status = useQuery({ queryKey: ["wearable-provider-status"], queryFn: () => statusFn(), staleTime: 300_000 });
  const startFn = useServerFn(startAggregatorConnection);
  const revokeFn = useServerFn(revokeConnection);
  const delConnFn = useServerFn(deleteConnectionData);
  const delAllFn = useServerFn(deleteAllWearableData);
  const csvFn = useServerFn(exportWearableCsv);
  const [consent, setConsent] = useState<AggSource | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ source: AggSource; code?: string; url?: string; error?: string } | null>(null);
  const [confirm, setConfirm] = useState<{ kind: "revoke" | "delete" | "deleteAll"; c?: ConnectionRow } | null>(null);
  const [msg, setMsg] = useState("");
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const i = setInterval(() => setNow(new Date()), 30_000); return () => clearInterval(i); }, []);
  const enabled = !!status.data?.junction;

  async function agree() {
    if (!consent) return;
    setBusy(true);
    try {
      const r = await startFn({ data: { source: consent, consent: true } });
      if (!r.ok) setResult({ source: consent, error: r.error === "em_breve" ? "Esta conexão ainda não está disponível." : "O provedor não respondeu. Tente de novo em instantes." });
      else if (r.ligacao.kind === "link") { setResult({ source: consent, url: r.ligacao.url }); window.open(r.ligacao.url, "_blank", "noopener"); }
      else setResult({ source: consent, code: r.ligacao.code });
      void qc.invalidateQueries({ queryKey: ["wearable-connections"] });
    } finally { setBusy(false); setConsent(null); }
  }

  async function doConfirm() {
    if (!confirm) return;
    try {
      if (confirm.kind === "revoke" && confirm.c) await revokeFn({ data: { id: confirm.c.id } });
      if (confirm.kind === "delete" && confirm.c) await delConnFn({ data: { id: confirm.c.id } });
      if (confirm.kind === "deleteAll") await delAllFn();
      setMsg(confirm.kind === "revoke" ? "Dispositivo desconectado. Nenhuma leitura nova será recebida." : "Dados apagados.");
      void qc.invalidateQueries({ queryKey: ["wearable-connections"] });
      void qc.invalidateQueries({ queryKey: ["wearable-readings"] });
    } catch { setMsg("Não foi possível concluir. Tente de novo."); }
    setConfirm(null);
  }

  async function exportCsv() {
    const { csv } = await csvFn();
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "anamedis-dispositivos.csv"; a.click(); URL.revokeObjectURL(url);
  }

  const list = conns.data ?? [];
  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-8">
        <PageTitle title="Dispositivos" subtitle="Relógio, anel, cinta cardíaca ou outros aplicativos." action={<Button asChild variant="outline" className="min-h-11"><Link to="/dispositivos/painel"><BarChart3 aria-hidden />Ver painel</Link></Button>} />

        {demo === 1 && (
          <section className="space-y-3">
            <p role="status" className="sticky top-16 z-10 rounded-lg bg-warning-soft px-4 py-2 text-sm font-semibold text-warning">Dados de demonstração — não são seus e não ficam salvos.</p>
            <WearablePanel rows={demoReadings(now.getTime())} now={now} />
          </section>
        )}

        {msg && <p role="status" className="rounded-lg bg-accent px-4 py-2 text-sm">{msg}</p>}

        <section aria-labelledby="conexoes">
          <h2 id="conexoes" className="mb-3 font-display text-xl font-bold">Suas conexões</h2>
          {conns.isLoading ? <Loader2 className="h-5 w-5 animate-spin" aria-label="Carregando" /> : list.length === 0 ? <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">Nenhum dispositivo conectado ainda.</p> : (
            <ul className="divide-y rounded-2xl border bg-card">
              {list.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-3 p-4">
                  <StatusIcon c={c} />
                  <div className="min-w-0 flex-1"><p className="font-medium">{c.display_name || SOURCES[c.source as Source] || c.source}</p><p className="text-sm text-muted-foreground">{connectionStatusText(c, now)}</p></div>
                  {c.status !== "revoked" && <Button variant="outline" className="min-h-11" onClick={() => setConfirm({ kind: "revoke", c })}><Unplug aria-hidden />Desconectar</Button>}
                  <Button variant="ghost" className="min-h-11 text-destructive" onClick={() => setConfirm({ kind: "delete", c })}><Trash2 aria-hidden />Apagar dados deste dispositivo</Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="conectar">
          <h2 id="conectar" className="mb-3 font-display text-xl font-bold">Conectar</h2>
          <div className="mb-4 rounded-2xl border bg-card p-5">
            <div className="flex items-center gap-2"><Watch className="h-5 w-5 text-brand-teal-strong" aria-hidden /><h3 className="font-semibold">Apple Watch / Apple Saúde</h3>{!enabled && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">Em breve</span>}</div>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
              <li>O Apple Watch envia seus dados para o app Saúde do iPhone automaticamente.</li>
              <li>Instale no iPhone o app de pareamento do nosso parceiro e permita que ele leia o app Saúde.</li>
              <li>Toque em "Conectar" aqui e digite no app o código que aparecer nesta tela.</li>
            </ol>
            <p className="mt-2 text-xs text-muted-foreground">As leituras chegam em até cerca de 1 hora, não na hora exata.</p>
            {enabled && <Button className="mt-3 min-h-11" onClick={() => setConsent("apple_health")}>Conectar</Button>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {AGG.filter((a) => a.id !== "apple_health").map((a) => (
              <div key={a.id} className="flex flex-col justify-between gap-3 rounded-2xl border bg-card p-4">
                <div><p className="flex items-center gap-2 font-semibold">{a.id === "health_connect" ? <Smartphone className="h-4 w-4 text-brand-teal-strong" aria-hidden /> : <Watch className="h-4 w-4 text-brand-teal-strong" aria-hidden />}{SOURCES[a.id]}</p><p className="text-sm text-muted-foreground">{a.hint}</p></div>
                {enabled ? <Button variant="outline" className="min-h-11" onClick={() => setConsent(a.id)}>Conectar</Button> : <span className="inline-flex min-h-11 items-center justify-center rounded-lg bg-muted text-sm font-semibold text-muted-foreground">Em breve</span>}
              </div>
            ))}
            <Link to="/dispositivos/api" className="flex flex-col justify-between gap-3 rounded-2xl border bg-card p-4 hover:bg-accent">
              <div><p className="flex items-center gap-2 font-semibold"><KeyRound className="h-4 w-4 text-brand-teal-strong" aria-hidden />Outro aplicativo</p><p className="text-sm text-muted-foreground">Envie leituras por API com um token seu.</p></div>
              <span className="text-sm font-semibold text-brand-teal-strong">Gerenciar tokens →</span>
            </Link>
          </div>
          {result && (
            <div role="status" className="mt-4 rounded-2xl border bg-accent p-5">
              {result.error ? <p className="text-sm">{result.error}</p> : result.code ? (
                <><p className="text-sm">Digite este código no app de pareamento:</p><p className="mt-2 font-mono text-3xl font-bold tracking-widest">{result.code}</p><p className="mt-2 text-xs text-muted-foreground">A conexão aparece como "Aguardando autorização" até o app confirmar.</p></>
              ) : <p className="text-sm">A autorização abriu em outra aba. Se não abriu, <a href={result.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-brand-teal-strong underline">abra aqui<ExternalLink className="h-3.5 w-3.5" aria-hidden /></a>.</p>}
            </div>
          )}
        </section>

        <section id="bluetooth" aria-labelledby="ble">
          <h2 id="ble" className="mb-3 font-display text-xl font-bold">Cinta cardíaca por Bluetooth</h2>
          <LiveHeartRate />
        </section>

        <section aria-labelledby="priv" className="rounded-2xl border bg-card p-5">
          <h2 id="priv" className="font-display text-xl font-bold">Privacidade dos dados de dispositivo</h2>
          <p className="mt-1 text-sm text-muted-foreground">Leituras ficam guardadas por 365 dias e depois são apagadas automaticamente. Só você vê; um profissional só vê um resumo quando você inclui sinais num código.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" className="min-h-11" onClick={exportCsv}><Download aria-hidden />Exportar leituras (CSV)</Button>
            <Button variant="outline" className="min-h-11 text-destructive" onClick={() => setConfirm({ kind: "deleteAll" })}><Trash2 aria-hidden />Apagar todos os dados de dispositivos</Button>
          </div>
        </section>
      </div>

      <Dialog open={!!consent} onOpenChange={(o) => !o && setConsent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conectar {consent ? SOURCES[consent] : ""}</DialogTitle>
            <DialogDescription>Antes de conectar, confira o que acontece com seus dados.</DialogDescription>
          </DialogHeader>
          <ul className="list-disc space-y-2 pl-5 text-sm">
            <li>Vamos ler, quando disponíveis: {CONSENT_METRICS}.</li>
            <li>Os dados passam pelo nosso provedor de integração (Junction) e ficam guardados no Anamedis.</li>
            <li>Só você vê. Profissionais veem apenas um resumo, e só quando você autorizar num código.</li>
            <li>Você pode desconectar e apagar os dados a qualquer momento.</li>
          </ul>
          <DialogFooter>
            <Button variant="outline" className="min-h-11" onClick={() => setConsent(null)}>Cancelar</Button>
            <Button className="min-h-11" disabled={busy} onClick={agree}>{busy && <Loader2 className="animate-spin" aria-hidden />}Concordo e conectar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.kind === "revoke" ? "Desconectar este dispositivo?" : confirm?.kind === "delete" ? "Apagar os dados deste dispositivo?" : "Apagar todos os dados de dispositivos?"}</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.kind === "revoke" ? "O Anamedis para de receber leituras dele. As leituras já recebidas continuam até você apagá-las." : "As leituras serão apagadas definitivamente. Isso não pode ser desfeito."}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="min-h-11" onClick={doConfirm}>{confirm?.kind === "revoke" ? "Desconectar" : "Apagar"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
