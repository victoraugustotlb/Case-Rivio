import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { AlertTriangle, BarChart3, Bluetooth, CheckCircle2, Clock, Download, ExternalLink, Loader2, Pencil, Smartphone, Trash2, Unplug, Watch } from "lucide-react";
import { AppShell, PageTitle } from "@/components/vita/AppShell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { LiveHeartRate } from "@/components/vita/LiveHeartRate";
import { ManualReading } from "@/components/vita/ManualReading";
import { ConnectIphone } from "@/components/vita/ConnectIphone";
import { WearablePanel } from "@/components/vita/WearablePanel";
import { connectionsQuery, useReadingsRealtime, type ConnectionRow } from "@/lib/wearables-query";
import { demoReadings } from "@/lib/wearables-demo";
import { connectionStatusText, SOURCES, type Source } from "@/lib/wearables";
import { deleteAllWearableData, deleteConnectionData, exportWearableCsv, revokeConnection, startAggregatorConnection, wearableProviderStatus } from "@/lib/wearables.functions";

export const Route = createFileRoute("/_authenticated/dispositivos/")({
  validateSearch: (s: Record<string, unknown>) => z.object({ demo: z.coerce.number().optional() }).catch({}).parse(s),
  head: () => ({
    meta: [
      { title: "Meus aparelhos — Anamedis" },
      { name: "description", content: "Anote medições, conecte o relógio ou use uma cinta de batimentos para guardar seus dados de saúde." },
      { property: "og:title", content: "Meus aparelhos — Anamedis" },
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
  const [way, setWay] = useState<"anotar" | "relogio" | "bluetooth">("anotar");
  const [watch, setWatch] = useState<"apple" | "outros">("apple");
  useEffect(() => { if (typeof window !== "undefined" && window.location.hash === "#bluetooth") setWay("bluetooth"); }, []);
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
        <PageTitle title="Meus aparelhos" subtitle="Escolha como quer guardar suas medições." action={<Button asChild variant="outline" className="min-h-11"><Link to="/dispositivos/painel"><BarChart3 aria-hidden />Ver painel</Link></Button>} />

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

        <section aria-labelledby="enviar">
          <h2 id="enviar" className="mb-3 font-display text-xl font-bold">Como você quer guardar suas medições?</h2>
          <div className="grid gap-3 sm:grid-cols-3" role="group" aria-label="Escolha um jeito">
            {([
              { id: "anotar", icon: Pencil, titulo: "Anotar uma medição", texto: "Qualquer pessoa pode. Leva 20 segundos." },
              { id: "relogio", icon: Watch, titulo: "Conectar meu relógio", texto: "Apple Watch e outros relógios." },
              { id: "bluetooth", icon: Bluetooth, titulo: "Cinta ou relógio com Bluetooth", texto: "Veja os batimentos ao vivo." },
            ] as const).map((w) => {
              const Icon = w.icon; const on = way === w.id;
              return (
                <button key={w.id} type="button" aria-pressed={on} onClick={() => setWay(w.id)}
                  className={`flex min-h-24 flex-col items-start gap-1 rounded-2xl border p-4 text-left ${on ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent"}`}>
                  <span className="flex items-center gap-2 font-semibold"><Icon className="h-5 w-5" aria-hidden />{w.titulo}</span>
                  <span className={`text-sm ${on ? "opacity-90" : "text-muted-foreground"}`}>{w.texto}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-4">
            {way === "anotar" && <ManualReading />}

            {way === "relogio" && (
              <div className="space-y-4">
                <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Qual é o seu relógio?">
                  {([{ id: "apple", t: "Apple Watch (iPhone)" }, { id: "outros", t: "Outro relógio (Android, Samsung, Xiaomi, Garmin…)" }] as const).map((o) => (
                    <button key={o.id} type="button" aria-pressed={watch === o.id} onClick={() => setWatch(o.id)}
                      className={`min-h-14 rounded-xl border px-4 text-left text-sm font-semibold ${watch === o.id ? "border-primary bg-accent" : "bg-card hover:bg-accent"}`}>{o.t}</button>
                  ))}
                </div>
                {watch === "apple" && <ConnectIphone />}
                {watch === "outros" && (
                  <div className="space-y-3 rounded-2xl border bg-card p-5 text-sm">
                    {enabled ? (
                      <>
                        <p>Escolha a marca e siga a autorização na tela seguinte.</p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {AGG.map((a) => (
                            <button key={a.id} type="button" onClick={() => setConsent(a.id)} className="flex min-h-14 items-center gap-2 rounded-xl border px-4 text-left font-semibold hover:bg-accent">
                              {a.id === "health_connect" ? <Smartphone className="h-4 w-4 text-brand-teal-strong" aria-hidden /> : <Watch className="h-4 w-4 text-brand-teal-strong" aria-hidden />}
                              <span>{SOURCES[a.id]}<span className="block text-xs font-normal text-muted-foreground">{a.hint}</span></span>
                            </button>
                          ))}
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="font-semibold">Para esses relógios, use um destes dois caminhos, que funcionam hoje:</p>
                        <ul className="list-disc space-y-1 pl-5">
                          <li><button type="button" className="font-semibold text-brand-teal-strong underline" onClick={() => setWay("anotar")}>Anotar a medição</button> que aparece no relógio ou no aplicativo dele.</li>
                          <li><button type="button" className="font-semibold text-brand-teal-strong underline" onClick={() => setWay("bluetooth")}>Ver os batimentos ao vivo</button>, se o seu relógio permite “transmitir batimentos” por Bluetooth (procure essa opção nos ajustes do relógio).</li>
                        </ul>
                        <p className="text-muted-foreground">A conexão automática com esses relógios depende de um serviço parceiro que ainda não foi ativado nesta versão do Anamedis.</p>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {way === "bluetooth" && (
              <div className="space-y-3">
                <ol className="list-decimal space-y-1 rounded-2xl border bg-card p-5 pl-9 text-sm">
                  <li>Ligue a cinta, ou ative “transmitir batimentos” no relógio.</li>
                  <li>Toque em <strong>Procurar aparelho</strong> abaixo.</li>
                  <li>Escolha o seu aparelho na lista que aparecer.</li>
                </ol>
                <section id="bluetooth" aria-label="Batimentos ao vivo"><LiveHeartRate /></section>
              </div>
            )}
          </div>

          {result && (
            <div role="status" className="mt-4 rounded-2xl border bg-accent p-5">
              {result.error ? <p className="text-sm">{result.error}</p> : result.code ? (
                <><p className="text-sm">Digite este código no app de pareamento:</p><p className="mt-2 font-mono text-3xl font-bold tracking-widest">{result.code}</p><p className="mt-2 text-xs text-muted-foreground">A conexão aparece como "Aguardando autorização" até o app confirmar.</p></>
              ) : <p className="text-sm">A autorização abriu em outra aba. Se não abriu, <a href={result.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-brand-teal-strong underline">abra aqui<ExternalLink className="h-3.5 w-3.5" aria-hidden /></a>.</p>}
            </div>
          )}
          <p className="mt-4 text-sm"><Link to="/dispositivos/api" className="font-medium text-brand-teal-strong underline">Avançado: senhas de conexão para outros aplicativos</Link></p>
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
