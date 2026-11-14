import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { agoText } from "@/lib/wearables";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowDown, ArrowUp, ChevronLeft, Clock3, Eye, FileText, Hash, Loader2, LockKeyhole, LogOut, Minus,
  Plus, Search, ShieldOff, Sparkles, Stethoscope, UserCheck,
} from "lucide-react";
import { checkShare, openShare, openSharedDocument, type SharedField } from "@/lib/documents.functions";
import { parseReference, REFERENCE_NOTE, type RefReading } from "@/lib/reference";
import { ageFromBirthDate } from "@/lib/profile";

export type Opened = Extract<Awaited<ReturnType<typeof openShare>>, { status: "valido" }>;
type Doc = Opened["docs"][number];
type Origin = "ia" | "paciente" | "original";
type View = { tab: "resumo" | "linha" } | { tab: "doc"; id: string };

const CATEGORIES = [
  { id: "exames", label: "Exames", kind: "Exame" },
  { id: "laudos", label: "Laudos", kind: "Laudo" },
  { id: "consultas", label: "Consultas", kind: "Consulta" },
  { id: "receitas", label: "Receitas", kind: "Receita" },
  { id: "vacinas", label: "Vacinas", kind: "Vacina" },
] as const;
const NOT_SHARED = "Não foi compartilhado pelo paciente";

function docTime(d: Doc): number {
  const m = d.doc_date?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])).getTime();
  const t = new Date(d.doc_date || d.created_at).getTime();
  return Number.isNaN(t) ? new Date(d.created_at).getTime() : t;
}
const fmt = (t: number) => new Date(t).toLocaleDateString("pt-BR");
function fieldOrigin(f: SharedField): Origin {
  if (f.ai_value === undefined) return "paciente";
  return f.value.trim() === f.ai_value.trim() ? "ia" : "paciente";
}

function OriginTag({ origin }: { origin: Origin }) {
  const map = {
    ia: [Sparkles, "Extraído por IA"],
    paciente: [UserCheck, "Confirmado pelo paciente"],
    original: [FileText, "Do documento original"],
  } as const;
  const [Icon, label] = map[origin];
  return <span className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] text-muted-foreground"><Icon className="h-3 w-3" aria-hidden />{label}</span>;
}

function RefTag({ r }: { r: RefReading }) {
  if (r.status === "acima") return <span className="inline-flex items-center gap-0.5 font-semibold text-destructive"><ArrowUp className="h-3 w-3" aria-hidden />Acima</span>;
  if (r.status === "abaixo") return <span className="inline-flex items-center gap-0.5 font-semibold text-warning"><ArrowDown className="h-3 w-3" aria-hidden />Abaixo</span>;
  if (r.status === "normal") return <span className="text-muted-foreground">Dentro da referência</span>;
  return <span className="text-muted-foreground">Não classificado</span>;
}

function Section({ title, count, children }: { title: string; count?: number | undefined; children: React.ReactNode }) {
  return (
    <section className="rounded-md border bg-card">
      <h2 className="flex items-center justify-between border-b bg-muted/50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}{count !== undefined && <span className="tabular-nums">{count}</span>}</h2>
      <div className="p-3 text-xs">{children}</div>
    </section>
  );
}
const Locked = () => <p className="flex items-center gap-1.5 text-muted-foreground"><LockKeyhole className="h-3.5 w-3.5" aria-hidden />{NOT_SHARED}</p>;
const Empty = ({ text }: { text: string }) => <p className="text-muted-foreground">{text}</p>;

function Sparkline({ points, refMax, unit }: { points: { t: number; v: number }[]; refMax: number | null; unit: string }) {
  const w = 220, h = 56, pad = 6;
  const vals = points.map((p) => p.v).concat(refMax !== null ? [refMax] : []);
  const min = Math.min(...vals) * 0.9, max = Math.max(...vals) * 1.1;
  const x = (i: number) => pad + (i * (w - 2 * pad)) / Math.max(1, points.length - 1);
  const y = (v: number) => h - pad - ((v - min) / (max - min || 1)) * (h - 2 * pad);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-14 w-full" role="img" aria-label={`Evolução: ${points.map((p) => `${fmt(p.t)} ${p.v} ${unit}`).join(", ")}`}>
      {refMax !== null && <><line x1={pad} x2={w - pad} y1={y(refMax)} y2={y(refMax)} className="stroke-warning" strokeDasharray="3 3" /><text x={w - pad} y={y(refMax) - 2} textAnchor="end" className="fill-muted-foreground text-[8px]">ref. {refMax}</text></>}
      <polyline fill="none" className="stroke-primary" strokeWidth={1.5} points={points.map((p, i) => `${x(i)},${y(p.v)}`).join(" ")} />
      {points.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.v)} r={2.5} className="fill-primary" />)}
    </svg>
  );
}

export type DocOpener = (documentId: string) => Promise<{ status: string; url?: string | null }>;

export function ClinicalView({ opened, onClose, onEnded, openDocument, embedded }: { opened: Opened; onClose: () => void; onEnded: () => void; openDocument?: DocOpener; embedded?: boolean }) {
  const check = useServerFn(checkShare);
  const openShared = useServerFn(openSharedDocument);
  const openDoc = useCallback<DocOpener>((id) => openDocument ? openDocument(id) : openShared({ data: { code: opened.code, documentId: id } }), [openDocument, openShared, opened.code]);
  const [view, setView] = useState<View>({ tab: "resumo" });
  const [now, setNow] = useState(() => Date.now());
  const endedRef = useRef(false);

  const verify = useCallback(async () => {
    try {
      const r = await check({ data: { code: opened.code } });
      if (r.status !== "valido" && r.status !== "bloqueado" && !endedRef.current) { endedRef.current = true; onEnded(); }
    } catch { /* rede instável: tenta de novo no próximo ciclo */ }
  }, [check, opened.code, onEnded]);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(() => void verify(), 30_000);
    return () => { clearInterval(tick); clearInterval(poll); };
  }, [verify]);

  const msLeft = new Date(opened.expiresAt).getTime() - now;
  useEffect(() => { if (msLeft <= 0 && !endedRef.current) { endedRef.current = true; onEnded(); } }, [msLeft, onEnded]);

  const go = (v: View) => { void verify(); setView(v); };

  const docs = opened.docs;
  const profile = opened.includeProfile ? opened.profile : null;
  const allowed = new Set<string>(opened.categories);
  const age = profile ? ageFromBirthDate(profile.birth_date) : null;
  const sec = Math.max(0, Math.floor(msLeft / 1000));
  const countdown = `${Math.floor(sec / 3600)}:${String(Math.floor((sec % 3600) / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;

  const results = useMemo(() => docs.flatMap((d) => d.fields.map((f) => ({ doc: d, field: f, ref: parseReference(f.value), t: docTime(d) }))), [docs]);
  const outOfRange = results.filter((r) => r.ref.status === "acima" || r.ref.status === "abaixo");
  const trends = [
    { label: "Glicose em jejum", unit: "mg/dL", match: /glic(ose|emia).*jejum|jejum.*glic/i },
    { label: "Colesterol LDL", unit: "mg/dL", match: /\bldl\b/i },
  ].map((tr) => {
    const pts = results.filter((r) => tr.match.test(r.field.label) && r.ref.value !== null).sort((a, b) => a.t - b.t);
    return { ...tr, points: pts.map((p) => ({ t: p.t, v: p.ref.value as number })), refMax: pts.at(-1)?.ref.max ?? null };
  });
  const sorted = [...docs].sort((a, b) => docTime(b) - docTime(a));

  const Source = ({ d }: { d: Doc }) => <button type="button" onClick={() => go({ tab: "doc", id: d.id })} className="text-left text-primary underline-offset-2 hover:underline">{d.title} · {fmt(docTime(d))}</button>;

  return (
    <div className={`${embedded ? "" : "min-h-screen"} bg-background font-sans text-[13px] text-foreground`}>
      <header className="sticky top-0 z-10 border-b bg-card">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2">
          <span className="flex items-center gap-1.5 font-semibold text-primary"><Stethoscope className="h-4 w-4" aria-hidden />Anamedis Clínico</span>
          <span className="font-semibold">{profile ? `${profile.full_name.trim() || "Nome não informado"}${age !== null ? ` · ${age} anos` : ""}` : "Identificação não autorizada"}</span>
          <span className="font-mono text-xs text-muted-foreground" title="Identificador desta sessão de acesso">Sessão {opened.session}</span>
          <span className="text-xs text-muted-foreground">Escopo: {[...CATEGORIES.filter((c) => allowed.has(c.id)).map((c) => c.label), ...(opened.includeProfile ? ["Perfil"] : [])].join(", ") || "—"} · Período: {opened.periodMonths === 60 ? "5 anos" : `${opened.periodMonths} meses`}</span>
          <span className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide"><Eye className="h-3 w-3" aria-hidden />Somente leitura</span>
          <span role="timer" aria-label="Tempo restante do acesso" className={`ml-auto inline-flex items-center gap-1 rounded px-2 py-0.5 font-mono text-xs tabular-nums ${sec < 300 ? "bg-warning-soft font-semibold text-warning" : "bg-muted"}`}><Clock3 className="h-3.5 w-3.5" aria-hidden />{countdown}</span>
          <button type="button" onClick={onClose} className="inline-flex min-h-8 items-center gap-1 rounded border px-2 text-xs hover:bg-muted"><LogOut className="h-3.5 w-3.5" aria-hidden />Sair</button>
        </div>
        <nav className="flex gap-1 px-4" aria-label="Áreas">
          {([["resumo", "Resumo clínico"], ["linha", "Linha do tempo"]] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => go({ tab: id })} aria-current={view.tab === id ? "page" : undefined} className={`border-b-2 px-3 py-1.5 text-xs font-medium ${view.tab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{label}</button>
          ))}
          {view.tab === "doc" && <span className="border-b-2 border-primary px-3 py-1.5 text-xs font-medium text-primary">Documento</span>}
        </nav>
      </header>

      <main className="mx-auto max-w-[1400px] p-4">
        {view.tab === "resumo" && opened.profileIncomplete && profile && <p role="status" className="mb-3 rounded border bg-warning-soft px-3 py-2 text-xs">Perfil incompleto: algumas respostas antigas do questionário não puderam ser lidas e aparecem em branco.</p>}
        {view.tab === "resumo" && (
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            <Section title="Alergias informadas">{profile ? (profile.allergies.trim() ? <><p className="whitespace-pre-line font-medium">{profile.allergies}</p><div className="mt-1"><OriginTag origin="paciente" /> <span className="text-[11px] text-muted-foreground">· Questionário do paciente</span></div></> : <Empty text="Nenhuma alergia informada pelo paciente." />) : <Locked />}</Section>
            <Section title="Medicamentos atuais" count={profile?.medications.length}>{profile ? (profile.medications.length ? <table className="w-full"><thead><tr className="text-left text-[11px] text-muted-foreground"><th className="py-1 font-medium">Medicamento</th><th className="font-medium">Dose</th><th className="font-medium">Frequência</th></tr></thead><tbody>{profile.medications.map((m, i) => <tr key={i} className="border-t"><td className="py-1 font-medium">{m.name}</td><td>{m.dose || "—"}</td><td>{m.frequency || "—"}</td></tr>)}</tbody></table> : <Empty text="Nenhum medicamento informado." />) : <Locked />}{profile && profile.medications.length > 0 && <div className="mt-1"><OriginTag origin="paciente" /></div>}</Section>
            <Section title="Condições registradas">{profile ? (profile.conditions.trim() ? <><p className="whitespace-pre-line">{profile.conditions}</p><div className="mt-1"><OriginTag origin="paciente" /></div></> : <Empty text="Nenhuma condição informada." />) : <Locked />}</Section>

            <div className="lg:col-span-2 xl:col-span-3">
              <Section title="Resultados fora da referência" count={allowed.has("exames") || allowed.has("laudos") ? outOfRange.length : undefined}>
                {!allowed.has("exames") && !allowed.has("laudos") ? <Locked /> : outOfRange.length === 0 ? <Empty text="Nenhum resultado fora da referência impressa nos documentos compartilhados." /> : (
                  <table className="w-full">
                    <thead><tr className="text-left text-[11px] text-muted-foreground"><th className="py-1 font-medium">Parâmetro</th><th className="font-medium">Resultado</th><th className="font-medium">Situação</th><th className="font-medium">Origem</th><th className="font-medium">Fonte</th></tr></thead>
                    <tbody>{outOfRange.map((r, i) => <tr key={i} className="border-t align-top"><td className="py-1 font-medium">{r.field.label}</td><td className="font-mono tabular-nums">{r.field.value}</td><td><RefTag r={r.ref} /></td><td><OriginTag origin={fieldOrigin(r.field)} /></td><td><Source d={r.doc} /></td></tr>)}</tbody>
                  </table>
                )}
                <p className="mt-2 text-[11px] text-muted-foreground">{REFERENCE_NOTE}</p>
              </Section>
            </div>

            <Section title="Evolução de resultados">
              {!allowed.has("exames") ? <Locked /> : <div className="space-y-3">{trends.map((tr) => <div key={tr.label}><p className="font-medium">{tr.label} <span className="text-muted-foreground">({tr.unit})</span></p>{tr.points.length >= 2 ? <Sparkline points={tr.points} refMax={tr.refMax} unit={tr.unit} /> : <Empty text={tr.points.length === 1 ? "Apenas 1 resultado — o gráfico aparece a partir de 2." : "Sem resultados nos documentos compartilhados."} />}</div>)}</div>}
            </Section>
            <Section title="Exames recentes" count={allowed.has("exames") ? docs.filter((d) => d.kind === "Exame").length : undefined}>
              {!allowed.has("exames") ? <Locked /> : (() => { const ex = sorted.filter((d) => d.kind === "Exame").slice(0, 8); return ex.length ? <ul className="divide-y">{ex.map((d) => <li key={d.id} className="flex items-center justify-between gap-2 py-1"><Source d={d} /><span className="text-[11px] text-muted-foreground">{d.source || "Emissor não informado"}</span></li>)}</ul> : <Empty text="Nenhum exame no período autorizado." />; })()}
            </Section>
            {(opened.signals?.length ?? 0) > 0 && <div className="lg:col-span-2 xl:col-span-3"><DeviceSignals items={opened.deviceSignals ?? []} /></div>}
            <Section title="Internações e cirurgias">{profile ? (profile.surgeries.trim() ? <><p className="whitespace-pre-line">{profile.surgeries}</p><div className="mt-1"><OriginTag origin="paciente" /></div></> : <Empty text="Nenhuma informada." />) : <Locked />}</Section>
            <Section title="Vacinas">{!allowed.has("vacinas") ? <Locked /> : (() => { const v = sorted.filter((d) => d.kind === "Vacina"); return v.length ? <ul className="divide-y">{v.map((d) => <li key={d.id} className="py-1"><Source d={d} /></li>)}</ul> : <Empty text="Nenhum registro de vacina no período." />; })()}</Section>
          </div>
        )}

        {view.tab === "linha" && <Timeline docs={sorted} allowed={allowed} onOpen={(id) => go({ tab: "doc", id })} />}
        {view.tab === "doc" && (() => { const d = docs.find((x) => x.id === view.id); return d ? <DocumentDetail key={d.id} doc={d} openDoc={openDoc} onEnded={onEnded} onBack={() => go({ tab: "linha" })} /> : null; })()}
      </main>
    </div>
  );
}

function Timeline({ docs, allowed, onOpen }: { docs: Doc[]; allowed: Set<string>; onOpen: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("todas");
  const [months, setMonths] = useState(0);
  const [onlyOut, setOnlyOut] = useState(false);
  const limit = months ? Date.now() - months * 30.44 * 86_400_000 : 0;
  const rows = docs.map((d) => ({ d, out: d.fields.filter((f) => { const s = parseReference(f.value).status; return s === "acima" || s === "abaixo"; }).length }))
    .filter(({ d, out }) => (cat === "todas" || CATEGORIES.find((c) => c.id === cat)?.kind === d.kind) && docTime(d) >= limit && (!onlyOut || out > 0)
      && `${d.title} ${d.source ?? ""} ${d.summary ?? ""} ${d.fields.map((f) => `${f.label} ${f.value}`).join(" ")}`.toLocaleLowerCase("pt-BR").includes(q.trim().toLocaleLowerCase("pt-BR")));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-card p-2 text-xs">
        <label className="flex min-w-56 flex-1 items-center gap-1.5 rounded border px-2"><Search className="h-3.5 w-3.5 text-muted-foreground" aria-hidden /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar em títulos, emissores e resultados" aria-label="Buscar" className="min-h-8 w-full bg-transparent outline-none" /></label>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Categoria">
          <button type="button" onClick={() => setCat("todas")} aria-pressed={cat === "todas"} className={`min-h-8 rounded border px-2 ${cat === "todas" ? "border-primary bg-primary-soft text-primary" : ""}`}>Todas</button>
          {CATEGORIES.map((c) => { const ok = allowed.has(c.id); return <button key={c.id} type="button" disabled={!ok} title={ok ? undefined : NOT_SHARED} onClick={() => setCat(c.id)} aria-pressed={cat === c.id} className={`inline-flex min-h-8 items-center gap-1 rounded border px-2 disabled:cursor-not-allowed disabled:opacity-50 ${cat === c.id ? "border-primary bg-primary-soft text-primary" : ""}`}>{!ok && <LockKeyhole className="h-3 w-3" aria-label="Não compartilhado" />}{c.label}</button>; })}
        </div>
        <select value={months} onChange={(e) => setMonths(Number(e.target.value))} aria-label="Período" className="min-h-8 rounded border bg-background px-2"><option value={0}>Todo o período autorizado</option><option value={3}>Últimos 3 meses</option><option value={6}>Últimos 6 meses</option><option value={12}>Últimos 12 meses</option></select>
        <label className="inline-flex min-h-8 items-center gap-1.5"><input type="checkbox" checked={onlyOut} onChange={(e) => setOnlyOut(e.target.checked)} />Só com valores fora da referência</label>
      </div>
      <div className="overflow-x-auto rounded-md border bg-card">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground"><tr><th className="px-3 py-1.5 font-semibold">Data</th><th className="font-semibold">Tipo</th><th className="font-semibold">Documento</th><th className="font-semibold">Emissor</th><th className="font-semibold">Fora da ref.</th><th className="font-semibold">Origem</th><th className="pr-3 font-semibold">Status</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="px-3 py-4 text-center text-muted-foreground">Nenhum documento com esses filtros.</td></tr>}
            {rows.map(({ d, out }) => (
              <tr key={d.id} className="cursor-pointer border-t hover:bg-muted/40" onClick={() => onOpen(d.id)}>
                <td className="px-3 py-1.5 font-mono tabular-nums">{fmt(docTime(d))}</td>
                <td>{d.kind}</td>
                <td><button type="button" className="text-left font-medium text-primary hover:underline" onClick={(e) => { e.stopPropagation(); onOpen(d.id); }}>{d.title}</button></td>
                <td className="text-muted-foreground">{d.source || "—"}</td>
                <td className="tabular-nums">{out ? <span className="font-semibold text-destructive">{out}</span> : "—"}</td>
                <td><OriginTag origin={d.origin === "Arquivo" || d.origin === "Escaneado" ? "original" : "paciente"} /></td>
                <td className="pr-3">{d.confirmed ? "Confirmada pelo paciente" : "Sugerida por IA"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">{REFERENCE_NOTE}</p>
    </div>
  );
}

function DocumentDetail({ doc, openDoc, onEnded, onBack }: { doc: Doc; openDoc: DocOpener; onEnded: () => void; onBack: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    let alive = true;
    openDoc(doc.id).then((r) => {
      if (!alive) return;
      if (r.status === "expirado" || r.status === "revogado") onEnded();
      else if (r.status === "valido") setUrl(r.url ?? null);
    }).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [doc.id, openDoc, onEnded]);
  const isPdf = doc.file_type === "application/pdf";
  return (
    <div className="space-y-2">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ChevronLeft className="h-3.5 w-3.5" aria-hidden />Linha do tempo</button>
      <p className="rounded border border-warning/40 bg-warning-soft px-3 py-1.5 text-xs font-medium text-warning">A informação válida é a do original.</p>
      <div className="grid gap-3 lg:grid-cols-2">
        <section className="flex min-h-[70vh] flex-col rounded-md border bg-card">
          <div className="flex items-center justify-between border-b px-3 py-1.5 text-xs">
            <span className="font-semibold">Original</span>
            <span className="flex items-center gap-1">
              <button type="button" aria-label="Diminuir zoom" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} className="grid h-7 w-7 place-items-center rounded border hover:bg-muted"><Minus className="h-3.5 w-3.5" /></button>
              <span className="w-10 text-center font-mono tabular-nums">{Math.round(zoom * 100)}%</span>
              <button type="button" aria-label="Aumentar zoom" onClick={() => setZoom((z) => Math.min(4, z + 0.25))} className="grid h-7 w-7 place-items-center rounded border hover:bg-muted"><Plus className="h-3.5 w-3.5" /></button>
            </span>
          </div>
          <div className="flex-1 overflow-auto bg-muted/40">
            {loading ? <p className="flex items-center gap-2 p-4 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Abrindo original…</p>
              : !url ? <p className="p-4 text-xs text-muted-foreground">Original indisponível.</p>
              : isPdf ? <iframe title={`Original: ${doc.title}`} src={url} style={{ width: `${zoom * 100}%`, height: `${zoom * 70}vh` }} className="bg-background" />
              : <img src={url} alt={`Original: ${doc.title}`} style={{ width: `${zoom * 100}%`, maxWidth: "none" }} />}
          </div>
        </section>
        <section className="space-y-3">
          <div className="rounded-md border bg-card">
            <h2 className="border-b bg-muted/50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Identificação</h2>
            <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-1 p-3 text-xs">
              <dt className="text-muted-foreground">Documento</dt><dd className="font-medium">{doc.title}</dd>
              <dt className="text-muted-foreground">Tipo</dt><dd>{doc.kind}</dd>
              <dt className="text-muted-foreground">Emissor</dt><dd>{doc.source || "Não informado"}</dd>
              <dt className="text-muted-foreground">Data</dt><dd className="font-mono tabular-nums">{fmt(docTime(doc))}</dd>
              <dt className="text-muted-foreground">Classificação</dt><dd>{doc.confirmed ? <OriginTag origin="paciente" /> : <OriginTag origin="ia" />} <span className="text-muted-foreground">({doc.confirmed ? "Confirmada pelo paciente" : "Sugerida por IA"})</span></dd>
              <dt className="flex items-center gap-1 text-muted-foreground"><Hash className="h-3 w-3" aria-hidden />SHA-256</dt><dd className="break-all font-mono text-[11px]">{doc.file_hash || "Não registrado (enviado antes desta verificação)"}</dd>
            </dl>
          </div>
          <div className="overflow-x-auto rounded-md border bg-card">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground"><tr><th className="px-3 py-1.5 font-semibold">Parâmetro</th><th className="font-semibold">Resultado</th><th className="px-2 font-semibold">Situação</th><th className="px-2 font-semibold">Confiança</th><th className="pr-3 font-semibold">Origem</th></tr></thead>
              <tbody>
                {doc.fields.length === 0 && <tr><td colSpan={5} className="px-3 py-3 text-muted-foreground">Sem dados estruturados.</td></tr>}
                {doc.fields.map((f, i) => (
                  <tr key={i} className="border-t align-top">
                    <td className="px-3 py-1.5 font-medium">{f.label}<p className="mt-0.5 font-normal text-[11px] text-muted-foreground">Trecho do original: <q className="font-mono">{f.excerpt?.trim() || "não registrado"}</q></p></td>
                    <td className="py-1.5 font-mono tabular-nums">{f.value}</td>
                    <td className="px-2 py-1.5"><RefTag r={parseReference(f.value)} /></td>
                    <td className="px-2 py-1.5 capitalize">{f.confidence === "media" ? "média" : f.confidence ?? "—"}</td>
                    <td className="py-1.5 pr-3"><OriginTag origin={fieldOrigin(f)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t px-3 py-1.5 text-[11px] text-muted-foreground">{REFERENCE_NOTE}</p>
          </div>
        </section>
      </div>
    </div>
  );
}

function DeviceSignals({ items }: { items: { metric: string; label: string; unit: string; summary: { last: number; min: number; avg: number; max: number; count: number; lastAt: string; device: string } }[] }) {
  const now = new Date();
  return (
    <Section title="Sinais de dispositivo" count={items.length}>
      {items.length === 0 ? <Empty text="Nenhuma leitura de dispositivo no período autorizado." /> : (
        <table className="w-full">
          <thead><tr className="text-left text-[11px] text-muted-foreground"><th className="py-1 font-medium">Sinal</th><th className="font-medium">Último</th><th className="font-medium">Mín · Média · Máx</th><th className="font-medium">Leituras</th><th className="font-medium">Origem</th></tr></thead>
          <tbody>{items.map((it) => <tr key={it.metric} className="border-t align-top"><td className="py-1 font-medium">{it.label}</td><td className="font-mono tabular-nums">{it.summary.last} {it.unit}</td><td className="font-mono tabular-nums">{it.summary.min} · {it.summary.avg} · {it.summary.max}</td><td className="tabular-nums">{it.summary.count}</td><td><span className="rounded border px-1.5 py-0.5 text-[11px]">Dispositivo: {it.summary.device || "não informado"}, sincronizado {agoText(it.summary.lastAt, now)}</span></td></tr>)}</tbody>
        </table>
      )}
      <p className="mt-2 text-[11px] text-muted-foreground">Não é medição clínica. Dados enviados por dispositivos do paciente.</p>
    </Section>
  );
}

export function AccessEnded({ onBack }: { onBack: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-background p-6 text-center font-sans">
      <div className="max-w-sm">
        <ShieldOff className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden />
        <h1 className="mt-3 font-display text-2xl font-semibold">Acesso encerrado</h1>
        <p className="mt-2 text-sm text-muted-foreground">O código expirou ou foi encerrado pelo paciente. Nenhuma informação permanece visível.</p>
        <button type="button" onClick={onBack} className="mt-5 min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">Abrir outro código</button>
      </div>
    </main>
  );
}
