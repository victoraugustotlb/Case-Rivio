import { createFileRoute } from "@tanstack/react-router";
import { Activity, Droplet, HeartPulse, Moon, Plus, RefreshCw, Watch } from "lucide-react";
import { AppShell, PageTitle } from "@/components/vita/AppShell";
import { devices, heartRate7d } from "@/lib/vita-data";
import { classifyBloodPressure, classifyGlucose, classifyHeartRate, statusLabel, type VitalStatus } from "@/lib/vitals";

export const Route = createFileRoute("/_authenticated/saude")({
  head: () => ({
    meta: [
      { title: "Saúde e dispositivos — VITA" },
      { name: "description", content: "Sinais vitais e sono vindos dos seus wearables e medidores, com a origem de cada dado." },
      { property: "og:title", content: "Saúde e dispositivos — VITA" },
      { property: "og:description", content: "Dados de wearables reunidos no seu histórico." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Saude,
});

const statusStyle: Record<VitalStatus, string> = { normal: "bg-success-soft text-success", atencao: "bg-warning-soft text-warning", alerta: "bg-danger-soft text-destructive" };
const vitals = [
  { label: "Pressão arterial", value: "128/82", unit: "mmHg", icon: Activity, status: classifyBloodPressure(128, 82), src: "Omron · hoje 08:10" },
  { label: "Frequência cardíaca", value: "74", unit: "bpm", icon: HeartPulse, status: classifyHeartRate(74), src: "Apple Watch · há 12 min" },
  { label: "Glicose", value: "108", unit: "mg/dL", icon: Droplet, status: classifyGlucose(108), src: "Accu-Chek · há 9 dias" },
  { label: "Sono", value: "6h40", unit: "", icon: Moon, status: "normal" as VitalStatus, src: "Apple Watch · última noite" },
];

function Saude() {
  const max = Math.max(...heartRate7d), min = Math.min(...heartRate7d);
  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-8">
        <PageTitle title="Saúde" subtitle="Informativo — não substitui avaliação médica" />
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {vitals.map(({ label, value, unit, icon: Icon, status, src }) => (
            <article key={label} className="rounded-2xl border bg-card p-4">
              <div className="flex items-center justify-between gap-2"><Icon className="h-5 w-5 text-primary" aria-hidden /><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusStyle[status]}`}>{statusLabel[status]}</span></div>
              <p className="mt-3 text-sm text-muted-foreground">{label}</p>
              <p className="font-display text-2xl font-semibold">{value} <span className="text-sm font-normal text-muted-foreground">{unit}</span></p>
              <p className="mt-1 text-xs text-muted-foreground">{src}</p>
            </article>
          ))}
        </section>
        <section className="rounded-2xl border bg-card p-6">
          <h2 className="font-semibold">Frequência cardíaca em repouso · 7 dias</h2>
          <div className="mt-4 flex h-40 items-end gap-2" role="img" aria-label={`Entre ${min} e ${max} bpm nos últimos 7 dias`}>
            {heartRate7d.map((v, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-xs text-muted-foreground">{v}</span>
                <div className="w-full rounded-t-md bg-primary" style={{ height: `${((v - 60) / 25) * 100}%` }} />
              </div>
            ))}
          </div>
        </section>
        <section>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-display text-xl font-semibold">Dispositivos conectados</h2>
            <button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-lg border bg-card px-4 text-sm font-medium"><Plus className="h-4 w-4" aria-hidden /> Conectar</button>
          </div>
          <ul className="grid gap-3 md:grid-cols-3">
            {devices.map((d) => (
              <li key={d.name} className="rounded-2xl border bg-card p-4">
                <div className="flex items-center gap-2"><Watch className="h-5 w-5 text-primary" aria-hidden /><p className="font-semibold">{d.name}</p></div>
                <p className="mt-2 text-sm text-muted-foreground">{d.what}</p>
                <p className={`mt-3 text-xs font-medium ${d.ok ? "text-success" : "text-warning"}`}>Última sincronização {d.synced}</p>
                {!d.ok && <button type="button" className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg bg-warning-soft px-3 text-sm font-medium text-warning"><RefreshCw className="h-4 w-4" aria-hidden /> Sincronizar agora</button>}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
