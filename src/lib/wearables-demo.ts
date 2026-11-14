// Demonstração: só em /dispositivos?demo=1, com faixa "Dados de demonstração". Nunca gravada no banco.
import type { ReadingRow } from "@/lib/wearables-query";

export function demoReadings(now: number): ReadingRow[] {
  const out: ReadingRow[] = [];
  const add = (metric: string, unit: string, t: number, value: number) => out.push({ id: `demo-${metric}-${t}`, metric, unit, value, measured_at: new Date(t).toISOString(), source_device: "Demonstração", connection_id: null });
  for (let i = 0; i < 48; i++) add("heart_rate", "bpm", now - i * 30 * 60_000, Math.round(70 + 8 * Math.sin(i / 3)));
  for (let d = 0; d < 14; d++) {
    const t = now - d * 86_400_000;
    add("resting_heart_rate", "bpm", t, 60 + (d % 4));
    add("steps", "passos", t, 6000 + ((d * 1370) % 4000));
    add("sleep_minutes", "min", t, 380 + ((d * 23) % 90));
    add("spo2", "%", t, 96 + (d % 3));
  }
  return out;
}
