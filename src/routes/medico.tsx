import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Clock, FileText, HeartPulse, LogOut, Stethoscope } from "lucide-react";
import { normalizeCode } from "@/lib/share";
import { docs, heartRate7d } from "@/lib/vita-data";

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
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"resumo" | "documentos" | "sinais">("resumo");
  const code = normalizeCode(input);
  const valid = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code);

  if (!open) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4 font-sans text-foreground">
        <form onSubmit={(e) => { e.preventDefault(); if (valid) setOpen(true); }} className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-soft">
          <div className="flex items-center gap-2 font-display text-2xl font-bold text-primary"><Stethoscope className="h-6 w-6" aria-hidden /> VITA Clínico</div>
          <h1 className="mt-6 font-display text-xl font-semibold">Abrir histórico do paciente</h1>
          <p className="mt-1 text-sm text-muted-foreground">Digite o código que o paciente mostrou.</p>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="XXXX-XXXX" aria-label="Código de acesso" autoComplete="off"
            className="mt-5 min-h-14 w-full rounded-lg border bg-background px-4 text-center font-display text-2xl tracking-widest uppercase" />
          <button type="submit" disabled={!valid} className="mt-4 min-h-12 w-full rounded-lg bg-primary font-semibold text-primary-foreground disabled:opacity-50">Abrir</button>
          <p className="mt-4 text-center text-xs text-muted-foreground">Demonstração: qualquer código de 8 caracteres abre um paciente fictício.</p>
          <Link to="/" className="mt-2 block text-center text-sm text-primary underline">Voltar ao app do paciente</Link>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-card px-6 py-4">
        <div className="flex items-center gap-2 font-display text-xl font-bold text-primary"><Stethoscope className="h-5 w-5" aria-hidden /> VITA Clínico</div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-3 py-1 font-medium text-warning"><Clock className="h-4 w-4" aria-hidden /> Acesso {code} · expira em 23h</span>
          <button type="button" onClick={() => { setOpen(false); setInput(""); }} className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 font-medium"><LogOut className="h-4 w-4" aria-hidden /> Encerrar</button>
        </div>
      </header>
      <div className="mx-auto max-w-7xl p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><h1 className="font-display text-3xl font-bold">Mariana Souza</h1><p className="text-muted-foreground">38 anos · Escopo: exames, laudos, consultas, receitas, FC e pressão · últimos 5 anos</p></div>
        </div>
        <div role="tablist" className="mt-6 flex gap-1 border-b">
          {(["resumo", "documentos", "sinais"] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} type="button" onClick={() => setTab(t)}
              className={`min-h-11 border-b-2 px-4 font-medium ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>
              {t === "resumo" ? "Resumo clínico" : t === "documentos" ? "Documentos" : "Sinais e dispositivos"}
            </button>
          ))}
        </div>
        {tab === "resumo" && (
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <section className="rounded-2xl border bg-card p-5"><h2 className="font-semibold">Medicamentos em uso</h2><p className="mt-3">Losartana 50 mg · 1x/dia</p><p className="text-xs text-muted-foreground">Receita de 10/12/2025 · não conferida pela paciente</p></section>
            <section className="rounded-2xl border bg-card p-5"><h2 className="font-semibold">Exames recentes</h2>
              <ul className="mt-3 space-y-1 text-sm">{docs.filter((d) => d.kind === "Exame" || d.kind === "Laudo").map((d) => <li key={d.id} className="flex justify-between gap-2"><span>{d.title}</span><span className="text-muted-foreground">{d.date}</span></li>)}</ul></section>
            <section className="rounded-2xl border bg-card p-5"><h2 className="font-semibold">Sinais recentes</h2><p className="mt-3">PA 128/82 mmHg · Omron · hoje</p><p>FC repouso 74 bpm · Apple Watch</p><p className="mt-2 text-xs text-muted-foreground">Dados de dispositivos são informativos.</p></section>
          </div>
        )}
        {tab === "documentos" && (
          <table className="mt-6 w-full overflow-hidden rounded-2xl border bg-card text-left text-sm">
            <thead className="bg-muted"><tr><th className="p-3">Documento</th><th className="p-3">Tipo</th><th className="p-3">Data</th><th className="p-3">Origem</th></tr></thead>
            <tbody>{docs.filter((d) => d.kind !== "Vacina").map((d) => (
              <tr key={d.id} className="border-t"><td className="p-3 font-medium"><FileText className="mr-2 inline h-4 w-4 text-primary" aria-hidden />{d.title}</td><td className="p-3">{d.kind}</td><td className="p-3">{d.date}</td><td className="p-3">{d.source} · {d.origin}</td></tr>
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
