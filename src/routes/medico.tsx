import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, AlertCircle, Clock, FileText, HeartPulse, LogOut, Stethoscope } from "lucide-react";
import { normalizeCode } from "@/lib/share";
import { useServerFn } from "@tanstack/react-start";
import { heartRate7d } from "@/lib/vita-data";
import { openShare } from "@/lib/documents.functions";

type Opened = Extract<Awaited<ReturnType<typeof openShare>>, { status: "valido" }>;

export const Route = createFileRoute("/medico")({
  head: () => ({
    meta: [
      { title: "VITA Clínico — Acesso por código" },
      { name: "description", content: "Profissionais de saúde abrem o histórico autorizado do paciente com o código temporário." },
      { property: "og:title", content: "VITA Clínico" },
      { property: "og:description", content: "Histórico completo do paciente em uma tela." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Medico,
});

function Medico() {
  const [input, setInput] = useState("");
  const [open, setOpen] = useState<Opened | null>(null);
  const [busy, setBusy] = useState(false);
  const abrir = useServerFn(openShare);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"resumo" | "documentos" | "sinais" | "linha">("resumo");
  const code = normalizeCode(input);
  const valid = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code);

  if (!open) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4 font-sans text-foreground">
        <form onSubmit={async (e) => { e.preventDefault(); if (!valid) return; setBusy(true); setError("");
          try {
            const r = await abrir({ data: { code } });
            if (r.status === "valido") setOpen(r);
            else setError(r.status === "expirado" ? "Este código expirou. Peça ao paciente para gerar um novo." : r.status === "revogado" ? "O paciente encerrou este acesso." : "Código não encontrado. Confira os caracteres.");
          } catch { setError("Não foi possível abrir agora. Tente novamente."); } finally { setBusy(false); } }} className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-soft">
          <div className="flex items-center gap-2 font-display text-2xl font-bold text-primary"><Stethoscope className="h-6 w-6" aria-hidden /> VITA Clínico</div>
          <h1 className="mt-6 font-display text-xl font-semibold">Abrir histórico do paciente</h1>
          <p className="mt-1 text-sm text-muted-foreground">Digite o código que o paciente mostrou no app dele.</p>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="XXXX-XXXX" aria-label="Código de acesso" autoComplete="off"
            className="mt-5 min-h-14 w-full rounded-lg border bg-background px-4 text-center font-display text-2xl tracking-widest uppercase" />
          {error && <p role="alert" className="mt-3 flex items-center gap-2 rounded-lg bg-danger-soft p-3 text-sm"><AlertCircle className="h-4 w-4 shrink-0" aria-hidden />{error}</p>}
          <button type="submit" disabled={!valid || busy} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary font-semibold text-primary-foreground disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Abrir</button>
          
          <Link to="/entrar" className="mt-2 block text-center text-sm text-primary underline">Voltar</Link>
        </form>
      </div>
    );
  }

  const docs = open.docs;
  const horas = Math.max(0, Math.round((new Date(open.expiresAt).getTime() - Date.now()) / 3600_000));
  const date = (d: (typeof docs)[number]) => d.doc_date || new Date(d.created_at).toLocaleDateString("pt-BR");
  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-card px-6 py-4">
        <div className="flex items-center gap-2 font-display text-xl font-bold text-primary"><Stethoscope className="h-5 w-5" aria-hidden /> VITA Clínico</div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-3 py-1 font-medium text-warning"><Clock className="h-4 w-4" aria-hidden /> Acesso {code} · expira em {horas}h</span>
          <button type="button" onClick={() => { setOpen(null); setInput(""); }} className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 font-medium"><LogOut className="h-4 w-4" aria-hidden /> Encerrar</button>
        </div>
      </header>
      <div className="mx-auto max-w-7xl p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><h1 className="font-display text-3xl font-bold">Histórico autorizado</h1><p className="text-muted-foreground">Escopo: {[...open.categories, ...open.signals].join(", ") || "—"} · últimos {open.periodMonths} meses · {docs.length} documento(s)</p></div>
        </div>
        <div role="tablist" className="mt-6 flex gap-1 overflow-x-auto border-b">
          {(["resumo", "linha", "documentos", "sinais"] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} type="button" onClick={() => setTab(t)}
              className={`min-h-11 border-b-2 px-4 font-medium ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>
              {t === "resumo" ? "Resumo clínico" : t === "linha" ? "Linha do tempo" : t === "documentos" ? "Documentos" : "Sinais e dispositivos"}
            </button>
          ))}
        </div>
        {tab === "resumo" && (
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <section className="rounded-2xl border bg-card p-5"><h2 className="font-semibold">Receitas</h2><ul className="mt-3 space-y-1 text-sm">{docs.filter((d) => d.kind === "Receita").map((d) => <li key={d.id}>{d.title}<span className="block text-xs text-muted-foreground">{date(d)}</span></li>)}{!docs.some((d) => d.kind === "Receita") && <li className="text-muted-foreground">Nenhuma receita compartilhada.</li>}</ul></section>
            <section className="rounded-2xl border bg-card p-5"><h2 className="font-semibold">Exames recentes</h2>
              <ul className="mt-3 space-y-1 text-sm">{docs.filter((d) => d.kind === "Exame" || d.kind === "Laudo").map((d) => <li key={d.id} className="flex justify-between gap-2"><span>{d.title}</span><span className="text-muted-foreground">{date(d)}</span></li>)}{!docs.some((d) => d.kind === "Exame" || d.kind === "Laudo") && <li className="text-muted-foreground">Nenhum exame compartilhado.</li>}</ul></section>
            <section className="rounded-2xl border bg-card p-5"><h2 className="font-semibold">Sinais recentes</h2>{open.signals.length ? <><p className="mt-3">PA 128/82 mmHg · Omron · hoje</p><p>FC repouso 74 bpm · Apple Watch</p></> : <p className="mt-3 text-muted-foreground">Nenhum dado de dispositivo compartilhado.</p>}<p className="mt-2 text-xs text-muted-foreground">Dados de dispositivos são informativos.</p></section>
          </div>
        )}
        {tab === "linha" && (
          <ol className="mt-6 space-y-4 border-l-2 border-primary/30 pl-6">
            {docs.map((d) => (
              <li key={d.id} className="relative rounded-2xl border bg-card p-4">
                <span className="absolute -left-[33px] top-5 h-3 w-3 rounded-full bg-primary" />
                <p className="text-xs text-muted-foreground">{date(d)} · {d.kind}</p>
                <p className="font-semibold">{d.title}</p>
                <p className="text-sm text-muted-foreground">{[d.source, d.origin].filter(Boolean).join(" · ")} · conferido pelo paciente</p>
              </li>
            ))}
          </ol>
        )}
        {tab === "documentos" && (
          <table className="mt-6 w-full overflow-hidden rounded-2xl border bg-card text-left text-sm">
            <thead className="bg-muted"><tr><th className="p-3">Documento</th><th className="p-3">Tipo</th><th className="p-3">Data</th><th className="p-3">Origem</th></tr></thead>
            <tbody>{docs.map((d) => (
              <tr key={d.id} className="border-t"><td className="p-3 font-medium">{d.url ? <a href={d.url} target="_blank" rel="noreferrer" className="text-primary underline"><FileText className="mr-2 inline h-4 w-4" aria-hidden />{d.title}</a> : d.title}{d.fields.length > 0 && <ul className="mt-1 text-xs font-normal text-muted-foreground">{d.fields.map((f, i) => <li key={i}>{f.label}: {f.value}</li>)}</ul>}</td><td className="p-3">{d.kind}</td><td className="p-3">{date(d)}</td><td className="p-3">{[d.source, d.origin].filter(Boolean).join(" · ")}</td></tr>
            ))}</tbody>
          </table>
        )}
        {tab === "sinais" && (
          <section className="mt-6 rounded-2xl border bg-card p-6">
            <h2 className="flex items-center gap-2 font-semibold"><HeartPulse className="h-5 w-5 text-primary" aria-hidden /> FC em repouso · 7 dias · Apple Watch</h2>
            <div className="mt-4 flex h-48 items-end gap-3">{heartRate7d.map((v, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1"><span className="text-xs text-muted-foreground">{v}</span><div className="w-full rounded-t-md bg-primary" style={{ height: `${((v - 60) / 25) * 100}%` }} /></div>
            ))}</div>
          </section>
        )}
      </div>
    </div>
  );
}
