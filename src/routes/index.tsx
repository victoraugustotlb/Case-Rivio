import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Activity, CalendarPlus, Check, Droplet, Eye, EyeOff, FileText, HeartPulse, Moon, PenLine, Pill, Siren, Video,
} from "lucide-react";
import { AppShell } from "@/components/vita/AppShell";
import {
  classifyBloodPressure, classifyGlucose, classifyHeartRate, statusLabel, type VitalStatus,
} from "@/lib/vitals";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Início — VITA Hub Pessoal de Saúde" },
      { name: "description", content: "Resumo da sua saúde: próxima consulta, medicamentos do dia, sinais vitais e atividades recentes." },
      { property: "og:title", content: "Início — VITA Hub Pessoal de Saúde" },
      { property: "og:description", content: "Resumo diário da sua saúde no VITA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

const statusStyle: Record<VitalStatus, string> = {
  normal: "bg-success-soft text-success",
  atencao: "bg-warning-soft text-warning",
  alerta: "bg-danger-soft text-destructive",
};

const vitals = [
  { label: "Pressão arterial", value: "128/82", unit: "mmHg", icon: Activity, status: classifyBloodPressure(128, 82), when: "Hoje, 08:10" },
  { label: "Frequência cardíaca", value: "74", unit: "bpm", icon: HeartPulse, status: classifyHeartRate(74), when: "Hoje, 08:10" },
  { label: "Glicemia em jejum", value: "108", unit: "mg/dL", icon: Droplet, status: classifyGlucose(108), when: "Ontem, 07:30" },
  { label: "Sono", value: "6h40", unit: "", icon: Moon, status: "normal" as VitalStatus, when: "Última noite · relógio" },
];

const actions = [
  { label: "Agendar consulta", icon: CalendarPlus },
  { label: "Resultados de exames", icon: FileText },
  { label: "Registrar medição", icon: PenLine },
  { label: "Cartão de emergência", icon: Siren },
];

const timeline = [
  { title: "Hemograma completo disponível", meta: "Laboratório Vida · 11 nov", sensitive: true },
  { title: "Consulta com Dra. Helena Prado", meta: "Cardiologia · 06 nov" },
  { title: "Losartana 50 mg adicionada", meta: "Prescrição de Dra. Helena · 06 nov" },
  { title: "Vacina Influenza registrada", meta: "UBS Centro · 28 out" },
];

function Dashboard() {
  const [hidden, setHidden] = useState(true);
  const [taken, setTaken] = useState(false);

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">Boa tarde,</p>
            <h1 className="truncate font-display text-3xl font-bold tracking-tight lg:text-4xl">Mariana</h1>
          </div>
          <button
            type="button"
            onClick={() => setHidden((h) => !h)}
            aria-pressed={!hidden}
            className="flex min-h-11 items-center gap-2 rounded-full border bg-card px-4 text-sm font-medium hover:bg-muted"
          >
            {hidden ? <Eye className="h-4 w-4" aria-hidden /> : <EyeOff className="h-4 w-4" aria-hidden />}
            {hidden ? "Mostrar valores" : "Ocultar valores"}
          </button>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <article className="bg-hero rounded-2xl p-6 text-primary-foreground shadow-soft lg:col-span-2">
            <p className="text-sm font-medium opacity-80">Próxima consulta · em 2 dias</p>
            <h2 className="mt-2 font-display text-2xl font-semibold">Dra. Helena Prado — Cardiologia</h2>
            <p className="mt-1 opacity-90">Domingo, 15 nov · 10:30 · Teleconsulta</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" className="flex min-h-11 items-center gap-2 rounded-lg bg-primary-foreground px-4 font-semibold text-primary">
                <Video className="h-4 w-4" aria-hidden /> Entrar na sala
              </button>
              <button type="button" className="min-h-11 rounded-lg border border-primary-foreground/40 px-4 font-medium hover:bg-primary-foreground/10">
                Remarcar
              </button>
            </div>
          </article>

          <article className="rounded-2xl border bg-card p-6 shadow-soft">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary"><Pill className="h-5 w-5" aria-hidden /></span>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">Próximo medicamento · 18:00</p>
                <h2 className="truncate font-semibold">Losartana 50 mg</h2>
              </div>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">1 comprimido, após o jantar.</p>
            <button
              type="button"
              onClick={() => setTaken(true)}
              disabled={taken}
              className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary font-semibold text-primary-foreground disabled:bg-success-soft disabled:text-success"
            >
              <Check className="h-4 w-4" aria-hidden /> {taken ? "Dose registrada" : "Confirmar dose"}
            </button>
          </article>
        </section>

        <section aria-labelledby="vitais">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 id="vitais" className="font-display text-xl font-semibold">Sinais vitais</h2>
            <p className="text-xs text-muted-foreground">Informativo — não substitui avaliação médica</p>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {vitals.map(({ label, value, unit, icon: Icon, status, when }) => (
              <article key={label} className="rounded-2xl border bg-card p-4">
                <div className="flex items-center justify-between gap-2">
                  <Icon className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusStyle[status]}`}>{statusLabel[status]}</span>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{label}</p>
                <p className={`font-display text-2xl font-semibold ${hidden ? "sensitive-blur" : ""}`} aria-label={hidden ? `${label}: valor oculto` : undefined}>
                  {value} <span className="text-sm font-normal text-muted-foreground">{unit}</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{when}</p>
              </article>
            ))}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          <section aria-labelledby="acoes">
            <h2 id="acoes" className="mb-3 font-display text-xl font-semibold">Ações rápidas</h2>
            <div className="grid grid-cols-2 gap-3">
              {actions.map(({ label, icon: Icon }) => (
                <button key={label} type="button" className="flex min-h-24 flex-col items-start justify-between rounded-2xl border bg-card p-4 text-left font-medium transition-colors hover:border-primary hover:bg-primary-soft">
                  <Icon className="h-5 w-5 text-primary" aria-hidden />
                  {label}
                </button>
              ))}
            </div>
          </section>

          <section aria-labelledby="recentes">
            <h2 id="recentes" className="mb-3 font-display text-xl font-semibold">Atividades recentes</h2>
            <ol className="rounded-2xl border bg-card p-2">
              {timeline.map((t) => (
                <li key={t.title} className="flex gap-3 rounded-xl p-3">
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" aria-hidden />
                  <div className="min-w-0">
                    <p className={`font-medium ${t.sensitive && hidden ? "sensitive-blur" : ""}`}>{t.title}</p>
                    <p className="text-sm text-muted-foreground">{t.meta}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
