import { METRICS, type Metric } from "@/lib/wearables";

/** Mini-gráfico em SVG; recebe só leituras reais. */
export function MiniChart({ points, height = 40, className = "" }: { points: { t: number; v: number }[]; height?: number; className?: string }) {
  if (points.length < 2) return <div style={{ height }} className={`grid place-items-center text-[11px] text-muted-foreground ${className}`}>{points.length === 1 ? "1 leitura" : "Sem leituras"}</div>;
  const w = 240;
  const ts = points.map((p) => p.t), vs = points.map((p) => p.v);
  const t0 = Math.min(...ts), t1 = Math.max(...ts), v0 = Math.min(...vs), v1 = Math.max(...vs);
  const x = (t: number) => (t1 === t0 ? w / 2 : ((t - t0) / (t1 - t0)) * (w - 4) + 2);
  const y = (v: number) => (v1 === v0 ? height / 2 : height - 3 - ((v - v0) / (v1 - v0)) * (height - 6));
  const d = [...points].sort((a, b) => a.t - b.t).map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  return <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className={`w-full text-brand-blue ${className}`} style={{ height }} aria-hidden><path d={d} fill="none" stroke="currentColor" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" /></svg>;
}

export function formatValue(metric: Metric, v: number): string {
  if (metric === "sleep_minutes") return `${Math.floor(v / 60)} h ${Math.round(v % 60)} min`;
  const u = METRICS[metric].unit;
  const n = Number.isInteger(v) ? v.toLocaleString("pt-BR") : v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  return u === "passos" ? `${n} passos` : `${n} ${u}`;
}
