import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { extractDocument } from "@/lib/documents.functions";
import { DOC_KINDS } from "@/lib/vita-data";
import { AlertCircle, ArrowLeft, Camera, Check, FileUp, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { AppShell } from "@/components/vita/AppShell";

export const Route = createFileRoute("/_authenticated/documentos/adicionar")({
  head: () => ({
    meta: [
      { title: "Adicionar documento — VITA" },
      { name: "description", content: "Escaneie ou envie exames, laudos, receitas e consultas antigas para o seu histórico." },
      { property: "og:title", content: "Adicionar documento — VITA" },
      { property: "og:description", content: "Adicione documentos médicos ao seu histórico." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Adicionar,
});

type Step = "escolher" | "analisando" | "conferir" | "salvo";
const steps = ["Enviar", "Análise", "Conferir", "Salvar"];
const stepIndex: Record<Step, number> = { escolher: 0, analisando: 1, conferir: 2, salvo: 3 };
const ACCEPT = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const MAX = 20 * 1024 * 1024;

type Draft = { title: string; kind: string; doc_date: string; source: string; summary: string; fields: { label: string; value: string; ai_value?: string; excerpt?: string; confidence?: string }[] };

function Adicionar() {
  const [step, setStep] = useState<Step>("escolher");
  const [error, setError] = useState("");
  const [file, setFile] = useState<{ path: string; type: string; preview: string; origin: string } | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const extract = useServerFn(extractDocument);
  const qc = useQueryClient();
  const nav = useNavigate();
  const cameraRef = useRef<HTMLInputElement>(null);

  const handle = async (f: File | undefined, origin: string) => {
    if (!f) return;
    setError("");
    if (!ACCEPT.includes(f.type)) { setError("Envie um PDF ou uma foto (JPG, PNG ou WEBP)."); return; }
    if (f.size > MAX) { setError("O arquivo passa de 20 MB. Envie um arquivo menor."); return; }
    setStep("analisando");
    let uploaded = false;
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sessão expirada. Entre novamente.");
      const ext = f.type === "application/pdf" ? "pdf" : f.type.split("/")[1];
      const path = `${u.user.id}/${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from("medical-documents").upload(path, f, { contentType: f.type });
      if (up.error) throw new Error("Não foi possível enviar o arquivo.");
      setFile({ path, type: f.type, preview: URL.createObjectURL(f), origin });
      uploaded = true;
      const r = await extract({ data: { path } });
      if (!r.legivel) {
        setError("Não conseguimos ler um documento médico nesse arquivo. Você pode preencher os campos à mão.");
      }
      setDraft({ title: r.titulo, kind: DOC_KINDS.includes(r.tipo as never) ? r.tipo : "Exame", doc_date: r.data, source: r.emissor, summary: r.resumo, fields: r.campos.map((c) => ({ label: c.rotulo, value: c.valor, ai_value: c.valor, excerpt: c.trecho, confidence: c.confianca })) });
      setStep("conferir");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha na leitura. Tente novamente.");
      setStep(uploaded ? "conferir" : "escolher");
      setDraft((d) => d ?? { title: "", kind: "Exame", doc_date: "", source: "", summary: "", fields: [] });
    }
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft || !file) return;
    setSaving(true); setError("");
    const { error: err } = await supabase.from("documents").insert({
      title: draft.title || "Documento sem título", kind: draft.kind, doc_date: draft.doc_date || null, source: draft.source || null,
      summary: draft.summary || null, fields: draft.fields.filter((f) => f.label || f.value), origin: file.origin,
      file_path: file.path, file_type: file.type, confirmed: true,
    });
    setSaving(false);
    if (err) { setError("Não foi possível salvar. Tente novamente."); return; }
    await qc.invalidateQueries({ queryKey: ["documents"] });
    setStep("salvo");
  };

  const descartar = async () => {
    if (file) await supabase.storage.from("medical-documents").remove([file.path]);
    setFile(null); setDraft(null); setError(""); setStep("escolher");
  };

  const set = (k: keyof Draft, v: string) => setDraft((d) => (d ? { ...d, [k]: v } : d));
  const inp = "mt-1 min-h-11 w-full rounded-lg border bg-background px-3";

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl">
        <Link to="/documentos" className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary"><ArrowLeft className="h-4 w-4" aria-hidden /> Meus documentos</Link>
        <h1 className="font-display text-3xl font-bold tracking-tight">Adicionar documento</h1>
        <ol className="mt-5 grid grid-cols-4 gap-2" aria-label="Etapas">
          {steps.map((s, i) => (
            <li key={s} aria-current={i === stepIndex[step] ? "step" : undefined} className="min-w-0">
              <div className={`h-1.5 rounded-full ${i <= stepIndex[step] ? "bg-primary" : "bg-muted"}`} />
              <p className={`mt-1 truncate text-xs ${i === stepIndex[step] ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{s}</p>
            </li>
          ))}
        </ol>

        {error && <p role="alert" className="mt-5 flex items-start gap-2 rounded-lg bg-danger-soft p-3 text-sm"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{error}</p>}

        <div className="mt-6">
          {step === "escolher" && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <button type="button" onClick={() => cameraRef.current?.click()} className="flex min-h-40 flex-col items-start justify-between rounded-2xl border bg-card p-5 text-left hover:border-primary hover:bg-primary-soft lg:hidden">
                <Camera className="h-7 w-7 text-primary" aria-hidden />
                <span><span className="block font-semibold">Fotografar com a câmera</span><span className="text-sm text-muted-foreground">Exames, laudos, receitas e anotações em papel</span></span>
              </button>
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} onChange={(e) => handle(e.target.files?.[0], "Escaneado")} />
              <label onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); handle(e.dataTransfer.files[0], "Arquivo"); }} className="flex min-h-40 cursor-pointer flex-col items-start justify-between rounded-2xl border bg-card p-5 hover:border-primary hover:bg-primary-soft lg:min-h-72 lg:items-center lg:justify-center lg:gap-4 lg:border-2 lg:border-dashed lg:text-center">
                <FileUp className="h-7 w-7 text-primary" aria-hidden />
                <span><span className="block font-semibold"><span className="lg:hidden">Escolher arquivo ou foto</span><span className="hidden lg:inline">Arraste o arquivo aqui ou clique para selecionar</span></span><span className="text-sm text-muted-foreground">PDF, JPG ou PNG · até 20 MB</span></span>
                <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => handle(e.target.files?.[0], "Arquivo")} />
              </label>
            </div>
          )}

          {step === "analisando" && (
            <div role="status" className="grid min-h-60 place-items-center rounded-2xl border bg-card p-8 text-center">
              <div><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" aria-hidden /><p className="mt-3 font-semibold">Lendo o documento…</p><p className="text-sm text-muted-foreground">Identificando tipo, data, emissor e resultados. Pode levar até 30 segundos.</p></div>
            </div>
          )}

          {step === "conferir" && draft && file && (
            <div className="space-y-4">
              <div className="flex gap-3 rounded-2xl bg-warning-soft p-4 text-sm">
                <Sparkles className="h-5 w-5 shrink-0 text-warning" aria-hidden />
                <p><strong>Sugestão automática — confira antes de salvar.</strong> Compare com o original e corrija o que estiver diferente.</p>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="overflow-hidden rounded-2xl border bg-muted lg:sticky lg:top-20 lg:h-[70vh]">
                  {file.type === "application/pdf"
                    ? <iframe src={file.preview} title="Original do documento" className="h-[60vh] w-full lg:h-full" />
                    : <img src={file.preview} alt="Original do documento" className="h-full max-h-[70vh] w-full object-contain" />}
                </div>
                <form className="space-y-3 rounded-2xl border bg-card p-5" onSubmit={salvar}>
                  <label className="block"><span className="text-sm text-muted-foreground">Nome do documento</span><input required value={draft.title} onChange={(e) => set("title", e.target.value)} className={inp} /></label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block"><span className="text-sm text-muted-foreground">Tipo</span>
                      <select value={draft.kind} onChange={(e) => set("kind", e.target.value)} className={inp}>{DOC_KINDS.map((k) => <option key={k}>{k}</option>)}</select></label>
                    <label className="block"><span className="text-sm text-muted-foreground">Data</span><input value={draft.doc_date} onChange={(e) => set("doc_date", e.target.value)} placeholder="DD/MM/AAAA" className={inp} /></label>
                  </div>
                  <label className="block"><span className="text-sm text-muted-foreground">Laboratório, clínica ou médico</span><input value={draft.source} onChange={(e) => set("source", e.target.value)} className={inp} /></label>
                  <label className="block"><span className="text-sm text-muted-foreground">Resumo</span><textarea value={draft.summary} onChange={(e) => set("summary", e.target.value)} rows={2} className={`${inp} py-2`} /></label>
                  <fieldset className="space-y-2">
                    <legend className="text-sm font-semibold">Resultados e informações</legend>
                    {draft.fields.map((f, i) => (
                      <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                        <input aria-label="Item" value={f.label} onChange={(e) => setDraft((d) => d && { ...d, fields: d.fields.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} className={inp} />
                        <input aria-label={`Valor de ${f.label}`} value={f.value} onChange={(e) => setDraft((d) => d && { ...d, fields: d.fields.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })} className={inp} />
                        <button type="button" aria-label={`Remover ${f.label}`} onClick={() => setDraft((d) => d && { ...d, fields: d.fields.filter((_, j) => j !== i) })} className="mt-1 grid h-11 w-11 place-items-center rounded-lg hover:bg-muted"><Trash2 className="h-4 w-4" aria-hidden /></button>
                      </div>
                    ))}
                    <button type="button" onClick={() => setDraft((d) => d && { ...d, fields: [...d.fields, { label: "", value: "" }] })} className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-primary"><Plus className="h-4 w-4" aria-hidden /> Adicionar item</button>
                  </fieldset>
                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={descartar} className="min-h-11 flex-1 rounded-lg border font-medium">Descartar</button>
                    <button type="submit" disabled={saving} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-primary font-semibold text-primary-foreground disabled:opacity-60">{saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Salvar no histórico</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {step === "salvo" && (
            <div className="rounded-2xl border bg-card p-8 text-center">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-success-soft text-success"><Check className="h-7 w-7" aria-hidden /></span>
              <h2 className="mt-4 font-display text-2xl font-semibold">Documento salvo</h2>
              <p className="mt-1 text-muted-foreground">{draft?.title || "O documento"} já faz parte do seu histórico.</p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <button type="button" onClick={() => { setFile(null); setDraft(null); setStep("escolher"); }} className="min-h-11 rounded-lg border px-4 font-medium">Adicionar outro</button>
                <button type="button" onClick={() => nav({ to: "/documentos" })} className="min-h-11 rounded-lg bg-primary px-4 font-semibold text-primary-foreground">Ver documentos</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
