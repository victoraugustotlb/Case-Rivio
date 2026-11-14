import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { agoText, freshness, freshnessLabel, isMetric, METRICS, METRIC_IDS, summarize, WINDOWS, type Metric, type WindowId } from "@/lib/wearables";
import { classifyBloodPressure, classifyGlucose, classifyRestingHeartRate, classifySpo2, statusLabel, type VitalStatus } from "@/lib/vitals";
import type { ReadingRow } from "@/lib/wearables-query";
import { formatValue, MiniChart } from "@/components/vita/WearableCharts";

export const DISCLAIMER = "Dados de dispositivo não substituem medição clínica nem diagnóstico.";

function band(metric: Metric, v: number, rows: ReadingRow[]): VitalStatus | null {
  if (metric === "spo2") return classifySpo2(v);
  if (metric === "resting_heart_rate") return classifyRestingHeartRate(v);
  if (metric === "glucose") return classifyGlucose(v);
  if (metric === "bp_systolic") { const d = rows.find((r) => r.metric === "bp_diastolic"); return d ? classifyBloodPressure(v, d.value) : null; }
  return null;
}

function Band({ s }: { s: VitalStatus }) {
  const Icon = s === "normal" ? CheckCircle2 : s === "atencao" ? Info : AlertTriangle;
  const cls = s === "normal" ? "bg-success-soft text-success" : s === "atencao" ? "bg-warning-soft text-warning" : "bg-danger-soft text-destructive";
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}><Icon className="h-3.5 w-3.5" aria-hidden />{statusLabel[s]} (informativo)</span>;
}

/** Um cartão por métrica com leituras; nunca mostra métrica sem dado. */
export function MetricCards({ rows, now, windowMs = WINDOWS["24h"], limit }: { rows: ReadingRow[]; now: Date; windowMs?: number; limit?: number }) {
  const metrics = METRIC_IDS.filter((m) => rows.some((r) => r.metric === m)).slice(0, limit);
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {metrics.map((m) => {
        const mine = rows.filter((r) => r.metric === m).sort((a, b) => new Date(b.measured_at).getTime() - new Date(a.measured_at).getTime());
        const last = mine[0]!;
        const sum = summarize(mine, { now, ms: windowMs });
        const conn = last.source_device;
        const fr = freshness(last.measured_at, now, "sync");
        const b = band(m, last.value, rows);
        return (
          <article key={m} className="rounded-2xl border bg-card p-4">
            <div className="flex items-start justify-between gap-2"><h3 className="text-sm font-semibold">{METRICS[m].label}</h3>{b && <Band s={b} />}</div>
            <p className="mt-1 font-display text-2xl font-extrabold tabular-nums">{formatValue(m, last.value)}</p>
            <p className="text-xs text-muted-foreground">{freshnessLabel(fr)} · {conn || "dispositivo"}</p>
            <MiniChart points={mine.slice(0, 200).map((r) => ({ t: new Date(r.measured_at).getTime(), v: r.value }))} className="mt-2" />
            {sum && <p className="mt-1 text-[11px] text-muted-foreground">Na janela: mín {sum.min} · média {sum.avg} · máx {sum.max} ({sum.count})</p>}
          </article>
        );
      })}
    </div>
  );
}

export function WearablePanel({ rows, now }: { rows: ReadingRow[]; now: Date }) {
  const [win, setWin] = useState<WindowId>("24h");
  const inWin = useMemo(() => rows.filter((r) => now.getTime() - new Date(r.measured_at).getTime() <= WINDOWS[win]), [rows, win, now]);
  const metricsHere = METRIC_IDS.filter((m) => inWin.some((r) => r.metric === m));
  const [sel, setSel] = useState<string>("heart_rate");
  const chosen: Metric = isMetric(sel) && metricsHere.includes(sel) ? sel : (metricsHere[0] ?? "heart_rate");
  const big = inWin.filter((r) => r.metric === chosen);
  const sum = summarize(big, { now, ms: WINDOWS[win] });
  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Período" className="inline-flex rounded-xl bg-muted p-1">
        {(["24h", "7d", "30d"] as const).map((w) => <button key={w} role="tab" aria-selected={win === w} type="button" onClick={() => setWin(w)} className={`min-h-10 rounded-lg px-4 text-sm font-semibold ${win === w ? "bg-card text-primary shadow-soft" : "text-muted-foreground"}`}>{w === "24h" ? "24 h" : w === "7d" ? "7 dias" : "30 dias"}</button>)}
      </div>
      {metricsHere.length === 0 ? <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">Sem leituras neste período.</p> : (
        <>
          <section className="rounded-2xl border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-sm font-semibold">Gráfico de <select value={chosen} onChange={(e) => setSel(e.target.value)} className="ml-1 min-h-10 rounded-lg border bg-card px-2">{metricsHere.map((m) => <option key={m} value={m}>{METRICS[m].label}</option>)}</select></label>
              {sum && <p className="text-xs text-muted-foreground">Última: {formatValue(chosen, sum.last)} · {agoText(sum.lastAt, now)} · {sum.device}</p>}
            </div>
            <MiniChart points={big.map((r) => ({ t: new Date(r.measured_at).getTime(), v: r.value }))} height={160} className="mt-4" />
          </section>
          <MetricCards rows={inWin} now={now} windowMs={WINDOWS[win]} />
        </>
      )}
      <p className="text-xs text-muted-foreground">{DISCLAIMER}</p>
    </div>
  );
}
