import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Camera, Check, FileUp, Loader2, ScanLine, Sparkles } from "lucide-react";
import { AppShell } from "@/components/vita/AppShell";

export const Route = createFileRoute("/documentos/adicionar")({
  head: () => ({
    meta: [
      { title: "Escanear documento — VITA" },
      { name: "description", content: "Escaneie ou envie exames, laudos, receitas e consultas antigas para o seu histórico." },
      { property: "og:title", content: "Escanear documento — VITA" },
      { property: "og:description", content: "Adicione documentos médicos ao seu histórico." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Adicionar,
});

type Step = "escolher" | "camera" | "analisando" | "conferir" | "salvo";
const steps = ["Enviar", "Análise", "Conferir", "Salvar"];
const stepIndex: Record<Step, number> = { escolher: 0, camera: 0, analisando: 1, conferir: 2, salvo: 3 };

function Adicionar() {
  const [step, setStep] = useState<Step>("escolher");
  const [fields, setFields] = useState([
    { label: "Tipo", value: "Exame de sangue" },
    { label: "Nome do exame", value: "Glicemia em jejum" },
    { label: "Resultado", value: "96 mg/dL" },
    { label: "Data da coleta", value: "02/09/2025" },
    { label: "Laboratório", value: "Laboratório Vida" },
  ]);
  const nav = useNavigate();

  useEffect(() => {
    if (step !== "analisando") return;
    const t = setTimeout(() => setStep("conferir"), 1800);
    return () => clearTimeout(t);
  }, [step]);

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
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

        <div className="mt-6">
          {step === "escolher" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => setStep("camera")} className="flex min-h-40 flex-col items-start justify-between rounded-2xl border bg-card p-5 text-left hover:border-primary hover:bg-primary-soft">
                <Camera className="h-7 w-7 text-primary" aria-hidden />
                <span><span className="block font-semibold">Escanear com a câmera</span><span className="text-sm text-muted-foreground">Exames, laudos, receitas e anotações de consultas em papel</span></span>
              </button>
              <label className="flex min-h-40 cursor-pointer flex-col items-start justify-between rounded-2xl border bg-card p-5 hover:border-primary hover:bg-primary-soft">
                <FileUp className="h-7 w-7 text-primary" aria-hidden />
                <span><span className="block font-semibold">Enviar arquivo</span><span className="text-sm text-muted-foreground">PDF, JPG ou PNG do laboratório ou do e-mail</span></span>
                <input type="file" accept="application/pdf,image/*" className="sr-only" onChange={(e) => e.target.files?.length && setStep("analisando")} />
              </label>
            </div>
          )}

          {step === "camera" && (
            <div className="space-y-4">
              <div className="relative grid aspect-[3/4] max-h-[60vh] w-full place-items-center overflow-hidden rounded-2xl bg-foreground sm:aspect-video">
                <div className="absolute inset-8 rounded-xl border-2 border-dashed border-primary-foreground/70" />
                <p className="relative px-6 text-center text-sm text-primary-foreground/80">Posicione o documento dentro da moldura, com boa luz e sem reflexos</p>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setStep("escolher")} className="min-h-11 flex-1 rounded-lg border font-medium">Cancelar</button>
                <button type="button" onClick={() => setStep("analisando")} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-primary font-semibold text-primary-foreground"><ScanLine className="h-4 w-4" aria-hidden /> Capturar</button>
              </div>
            </div>
          )}

          {step === "analisando" && (
            <div role="status" className="grid min-h-60 place-items-center rounded-2xl border bg-card p-8 text-center">
              <div><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" aria-hidden /><p className="mt-3 font-semibold">Lendo o documento…</p><p className="text-sm text-muted-foreground">Estamos identificando tipo, data e resultados.</p></div>
            </div>
          )}

          {step === "conferir" && (
            <div className="space-y-4">
              <div className="flex gap-3 rounded-2xl bg-warning-soft p-4 text-sm">
                <Sparkles className="h-5 w-5 shrink-0 text-warning" aria-hidden />
                <p><strong>Sugestão automática — confira antes de salvar.</strong> Corrija qualquer campo que não corresponda ao original.</p>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="grid min-h-60 place-items-center rounded-2xl border bg-muted text-sm text-muted-foreground">Prévia do original</div>
                <form className="space-y-3 rounded-2xl border bg-card p-5" onSubmit={(e) => { e.preventDefault(); setStep("salvo"); }}>
                  {fields.map((f, i) => (
                    <label key={f.label} className="block">
                      <span className="text-sm text-muted-foreground">{f.label}</span>
                      <input value={f.value} onChange={(e) => setFields((fs) => fs.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
                        className="mt-1 min-h-11 w-full rounded-lg border bg-background px-3" />
                    </label>
                  ))}
                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setStep("camera")} className="min-h-11 flex-1 rounded-lg border font-medium">Refazer</button>
                    <button type="submit" className="min-h-11 flex-1 rounded-lg bg-primary font-semibold text-primary-foreground">Salvar no histórico</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {step === "salvo" && (
            <div className="rounded-2xl border bg-card p-8 text-center">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-success-soft text-success"><Check className="h-7 w-7" aria-hidden /></span>
              <h2 className="mt-4 font-display text-2xl font-semibold">Documento salvo</h2>
              <p className="mt-1 text-muted-foreground">{fields[1]?.value ?? "O documento"} já faz parte do seu histórico.</p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <button type="button" onClick={() => setStep("escolher")} className="min-h-11 rounded-lg border px-4 font-medium">Adicionar outro</button>
                <button type="button" onClick={() => nav({ to: "/documentos" })} className="min-h-11 rounded-lg bg-primary px-4 font-semibold text-primary-foreground">Ver documentos</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
