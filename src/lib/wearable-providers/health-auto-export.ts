// Tradutor do envio do app "Health Auto Export" (iPhone, Apple Saúde) para leituras do Anamedis.
// Função pura, testada em health-auto-export.test.ts. Formato conforme a documentação do app:
// https://help.healthyapps.dev/en/health-auto-export/export-format/health-metrics
// Só traduz o que a documentação descreve (frequência cardíaca, passos por dia, pressão, glicose, sono por dia).
import type { ReadingInput } from "@/lib/wearables";

export const HAE_MAX_READINGS = 5000;

export type HaeResult = { device: string; readings: ReadingInput[]; ignoredMetrics: string[] };

/** "2024-02-06 14:30:00 -0800" → "2024-02-06T14:30:00-08:00". */
export function haeDateToIso(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const m = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-])(\d{2})(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const iso = `${m[1]}T${m[2]}${m[3]}${m[4]}:${m[5]}`;
  return Number.isNaN(new Date(iso).getTime()) ? null : iso;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Devolve null quando o corpo não tem o formato do app (data.metrics); o chamador então valida o formato próprio. */
export function mapHealthAutoExport(payload: unknown): HaeResult | null {
  if (!isObj(payload) || !isObj(payload["data"]) || !Array.isArray(payload["data"]["metrics"])) return null;
  const readings: ReadingInput[] = [];
  const ignored = new Set<string>();
  let device = "";
  const push = (r: ReadingInput) => { if (readings.length < HAE_MAX_READINGS) readings.push(r); };

  for (const metric of payload["data"]["metrics"] as unknown[]) {
    if (!isObj(metric) || typeof metric["name"] !== "string" || !Array.isArray(metric["data"])) continue;
    const name = metric["name"];
    const units = typeof metric["units"] === "string" ? metric["units"] : "";
    let used = false;
    for (const item of metric["data"] as unknown[]) {
      if (!isObj(item)) continue;
      const at = haeDateToIso(item["date"]);
      if (!at) continue;
      const before = readings.length;
      if (name === "heart_rate") {
        const v = num(item["Avg"]) ?? num(item["qty"]);
        if (v !== null) push({ metric: "heart_rate", value: Math.round(v * 10) / 10, unit: "bpm", measured_at: at });
      } else if (name === "step_count") {
        // Só total diário (data à meia-noite): somas parciais gravariam um total errado.
        const q = num(item["qty"]);
        if (q !== null && /T00:00:00/.test(at)) push({ metric: "steps", value: Math.round(q), unit: "passos", measured_at: at });
      } else if (name === "blood_pressure") {
        const s = num(item["systolic"]); const d = num(item["diastolic"]);
        if (s !== null && d !== null) {
          push({ metric: "bp_systolic", value: s, unit: "mmHg", measured_at: at });
          push({ metric: "bp_diastolic", value: d, unit: "mmHg", measured_at: at });
        }
      } else if (name === "blood_glucose") {
        const q = num(item["qty"]);
        if (q !== null && units === "mg/dL") push({ metric: "glucose", value: q, unit: "mg/dL", measured_at: at });
      } else if (name === "sleep_analysis") {
        const t = num(item["totalSleep"]); // resumo diário em horas
        if (t !== null) push({ metric: "sleep_minutes", value: Math.round(t * 60), unit: "min", measured_at: at });
      }
      if (readings.length > before) { used = true; if (!device && typeof item["source"] === "string") device = item["source"].trim(); }
    }
    if (!used && !["heart_rate", "step_count", "blood_pressure", "blood_glucose", "sleep_analysis"].includes(name)) ignored.add(name);
  }
  return { device: (device || "Apple Saúde").slice(0, 80), readings, ignoredMetrics: [...ignored].slice(0, 30) };
}
