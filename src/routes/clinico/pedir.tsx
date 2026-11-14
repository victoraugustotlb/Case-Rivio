import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock3, Loader2, RefreshCw } from "lucide-react";
import { createAccessRequest, getAccessRequest } from "@/lib/clinic.functions";
import { listSentRequests } from "@/lib/pro.functions";
import { REQUEST_CODE_LABEL } from "@/lib/codes";
import { formatRequestCode, isPatientRef, normalizePatientRef } from "@/lib/clinic";
import { PERIOD_OPTIONS, type ShareCategory, type ShareSignal } from "@/lib/share";
import { CATS, SIGS, ProPage, StatusTag, fmtDT, scopeText, td, th } from "@/components/vita/pro-ui";

export const Route = createFileRoute("/clinico/pedir")({
  validateSearch: (s: Record<string, unknown>): { ref?: string } => (typeof s["ref"] === "string" ? { ref: s["ref"] } : {}),
  head: () => ({ meta: [
    { title: "Pedir acesso — VITA Clínico" }, { name: "description", content: "Gere um código de 6 dígitos e peça ao paciente só o que precisa." },
    { property: "og:title", content: "Pedir acesso — VITA Clínico" }, { property: "og:description", content: "Pedido de acesso com escopo, período e permissão de envio." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: Pedir,
});

const chip = (on: boolean) => `h-8 rounded border px-2 text-xs font-medium ${on ? "border-primary bg-accent text-primary" : "bg-card hover:bg-muted"}`;
const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

function Pedir() {
  const search = Route.useSearch();
  const nav = useNavigate();
  const qc = useQueryClient();
  const create = useServerFn(createAccessRequest);
  const poll = useServerFn(getAccessRequest);
  const listFn = useServerFn(listSentRequests);
  const sent = useQuery({ queryKey: ["pro-requests"], queryFn: () => listFn(), refetchInterval: 15_000 });
  const [ref, setRef] = useState(search.ref ?? "");
  const [cats, setCats] = useState<ShareCategory[]>(["exames", "laudos"]);
  const [sigs, setSigs] = useState<ShareSignal[]>([]);
  const [profile, setProfile] = useState(true);
  const [upload, setUpload] = useState(false);
  const [period, setPeriod] = useState<number>(12);
  const [req, setReq] = useState<{ id: string; code: string; expires_at: string } | null>(null);
  const [state, setState] = useState("pending");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const refNorm = ref.trim() ? normalizePatientRef(ref) : "";

  const navigated = useRef(false);
  // Repete a cada 3 s só enquanto pendente; para ao desmontar; consulta de novo quando a aba volta ao foco.
  useEffect(() => {
    if (!req || state !== "pending") return;
    let alive = true;
    const tick = async () => {
      try {
        const r = await poll({ data: { id: req.id } });
        if (!alive) return;
        setState(r.status);
        if (r.status !== "pending") { void qc.invalidateQueries({ queryKey: ["pro-requests"] }); void qc.invalidateQueries({ queryKey: ["pro-patients"] }); }
        if (r.status === "authorized" && r.patientId && !navigated.current) { navigated.current = true; nav({ to: "/clinico/paciente/$id", params: { id: r.patientId } }); }
      } catch { /* tenta de novo no próximo ciclo */ }
    };
    const t = setInterval(tick, 3000);
    const onVis = () => { if (document.visibilityState === "visible") void tick(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { alive = false; clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, [req, state, poll, nav, qc]);

  const gerar = async () => {
    if (refNorm && !isPatientRef(refNorm)) { setError("ID inválido. Use o formato VT-XXXXXXXX."); return; }
    setBusy(true); setError("");
    try {
      setReq(await create({ data: { categories: cats, signals: sigs, includeProfile: profile, periodMonths: period, requestUpload: upload, ...(refNorm ? { patientRef: refNorm } : {}) } }));
      navigated.current = false; setState("pending"); void qc.invalidateQueries({ queryKey: ["pro-requests"] });
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível gerar."); } finally { setBusy(false); }
  };

  return (
    <ProPage title="Pedir acesso" subtitle="O paciente digita o código em Autorizar médico e vê cada item pedido.">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="space-y-3 rounded border bg-card p-3">
          {!req ? (<>
            <label className="block text-xs font-semibold">Paciente já atendido (opcional)
              <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="VT-XXXXXXXX — deixe vazio para novo paciente" className="mt-1 h-9 w-full rounded border bg-background px-2 font-mono text-sm" /></label>
            <fieldset><legend className="text-xs font-semibold">Informações</legend><div className="mt-1 flex flex-wrap gap-1.5">
              <button type="button" aria-pressed={profile} onClick={() => setProfile(!profile)} className={chip(profile)}>Perfil de saúde</button>
              {CATS.map(([k, l]) => <button key={k} type="button" aria-pressed={cats.includes(k)} onClick={() => setCats(toggle(cats, k))} className={chip(cats.includes(k))}>{l}</button>)}
            </div></fieldset>
            <fieldset><legend className="text-xs font-semibold">Sinais (dispositivos)</legend><div className="mt-1 flex flex-wrap gap-1.5">{SIGS.map(([k, l]) => <button key={k} type="button" aria-pressed={sigs.includes(k)} onClick={() => setSigs(toggle(sigs, k))} className={chip(sigs.includes(k))}>{l}</button>)}</div></fieldset>
            <fieldset><legend className="text-xs font-semibold">Período dos documentos</legend><div className="mt-1 flex flex-wrap gap-1.5">{PERIOD_OPTIONS.map((p) => <button key={p} type="button" aria-pressed={period === p} onClick={() => setPeriod(p)} className={chip(period === p)}>{p === 60 ? "60 meses" : `${p} meses`}</button>)}</div></fieldset>
            <label className="flex items-start gap-2 rounded border p-2 text-xs"><input type="checkbox" checked={upload} onChange={(e) => setUpload(e.target.checked)} className="mt-0.5" />
              <span><span className="font-semibold">Pedir também permissão para adicionar documentos</span><br /><span className="text-muted-foreground">O paciente decide separadamente. Vence junto com o acesso.</span></span></label>
            {error && <p role="alert" className="rounded bg-danger-soft p-2 text-xs">{error}</p>}
            <button onClick={gerar} disabled={busy} className="flex h-9 items-center gap-2 rounded bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Gerar código de 6 dígitos</button>
          </>) : (
            <div className="py-4 text-center">
              <p className="text-xs text-muted-foreground"><strong>{REQUEST_CODE_LABEL}</strong> · o paciente abre o VITA → Autorizar médico → digita:</p>
              <p className="mt-3 font-mono text-5xl font-bold tracking-[0.2em] text-primary" aria-live="polite">{formatRequestCode(req.code)}</p>
              <p className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" aria-hidden />Válido até {new Date(req.expires_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
              <p className="mx-auto mt-4 flex max-w-sm items-center justify-center gap-2 rounded bg-muted p-2 text-xs" role="status">
                {state === "pending" ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Aguardando o paciente…</> : state === "authorized" ? "Autorizado. Abrindo histórico…" : state === "declined" ? "O paciente recusou o pedido. Nenhuma informação foi liberada." : "O código expirou antes de o paciente responder."}
              </p>
              <button onClick={() => setReq(null)} className="mt-3 inline-flex h-9 items-center gap-2 rounded border px-3 text-xs font-semibold"><RefreshCw className="h-3.5 w-3.5" aria-hidden />{state === "declined" || state === "expired" ? "Gerar novo código" : "Novo pedido"}</button>
            </div>
          )}
        </section>
        <section className="overflow-x-auto rounded border bg-card">
          <h2 className="border-b px-2 py-1.5 text-xs font-semibold">Solicitações enviadas</h2>
          <table className="w-full text-[12px]"><thead><tr><th className={th}>Paciente</th><th className={th}>Pedido</th><th className={th}>Estado</th></tr></thead>
            <tbody>{(sent.data ?? []).map((x) => (
              <tr key={x.id}><td className={td}>{x.patient}<br /><span className="text-[11px] text-muted-foreground">{fmtDT(x.createdAt)}{x.code ? ` · ${formatRequestCode(x.code)}` : ""}</span></td>
                <td className={td}>{scopeText(x)}{x.requestUpload ? ` · envio ${x.uploadGranted ? "liberado" : x.status === "authorized" ? "negado" : "pedido"}` : ""}</td><td className={td}><StatusTag s={x.status} /></td></tr>
            ))}{(sent.data ?? []).length === 0 && <tr><td colSpan={3} className={`${td} text-muted-foreground`}>Nenhuma solicitação ainda.</td></tr>}</tbody></table>
        </section>
      </div>
    </ProPage>
  );
}
