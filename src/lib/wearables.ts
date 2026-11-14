// Regras de dados de dispositivo (wearables) — funções puras, testadas em wearables.test.ts.
// Dados de dispositivo vêm só de leituras reais; nunca de exemplo.

export type Metric =
  | "heart_rate" | "resting_heart_rate" | "hrv" | "spo2" | "steps" | "sleep_minutes"
  | "bp_systolic" | "bp_diastolic" | "glucose" | "weight" | "temperature";

export const METRICS: Record<Metric, { label: string; unit: string; min: number; max: number }> = {
  heart_rate: { label: "Frequência cardíaca", unit: "bpm", min: 20, max: 250 },
  resting_heart_rate: { label: "FC em repouso", unit: "bpm", min: 25, max: 150 },
  hrv: { label: "Variabilidade da FC", unit: "ms", min: 1, max: 300 },
  spo2: { label: "Oxigenação (SpO₂)", unit: "%", min: 50, max: 100 },
  steps: { label: "Passos (dia)", unit: "passos", min: 0, max: 100000 },
  sleep_minutes: { label: "Sono", unit: "min", min: 0, max: 1440 },
  bp_systolic: { label: "Pressão sistólica", unit: "mmHg", min: 50, max: 260 },
  bp_diastolic: { label: "Pressão diastólica", unit: "mmHg", min: 30, max: 160 },
  glucose: { label: "Glicose", unit: "mg/dL", min: 20, max: 600 },
  weight: { label: "Peso", unit: "kg", min: 2, max: 700 },
  temperature: { label: "Temperatura", unit: "°C", min: 30, max: 45 },
};
export const METRIC_IDS = Object.keys(METRICS) as Metric[];
export const isMetric = (m: string): m is Metric => m in METRICS;

export type ReadingInput = { metric: string; value: number; unit: string; measured_at: string };
export type RejectReason = "metrica_invalida" | "unidade_invalida" | "fora_da_faixa" | "data_futura" | "data_antiga";
export const REJECT_LABEL: Record<RejectReason, string> = {
  metrica_invalida: "Métrica desconhecida",
  unidade_invalida: "Unidade diferente da esperada",
  fora_da_faixa: "Valor fora da faixa plausível",
  data_futura: "Data no futuro",
  data_antiga: "Data com mais de 2 anos",
};

const FUTURE_MS = 5 * 60_000;
const OLD_MS = 2 * 365.25 * 24 * 3600_000;

export function validateReading(r: ReadingInput, now: Date): { ok: true } | { ok: false; reason: RejectReason } {
  if (!isMetric(r.metric)) return { ok: false, reason: "metrica_invalida" };
  const def = METRICS[r.metric];
  if (r.unit !== def.unit) return { ok: false, reason: "unidade_invalida" };
  if (!Number.isFinite(r.value) || r.value < def.min || r.value > def.max) return { ok: false, reason: "fora_da_faixa" };
  const t = new Date(r.measured_at).getTime();
  if (!Number.isFinite(t)) return { ok: false, reason: "data_antiga" };
  if (t - now.getTime() > FUTURE_MS) return { ok: false, reason: "data_futura" };
  if (now.getTime() - t > OLD_MS) return { ok: false, reason: "data_antiga" };
  return { ok: true };
}

export type Freshness = { kind: "ao_vivo" } | { kind: "atualizado_ha_N_min"; minutes: number } | { kind: "sem_dados_recentes"; days: number };

/** "Ao vivo" só para Bluetooth com leitura de até 5 s; dados sincronizados nunca são "tempo real". */
export function freshness(measuredAt: Date | string, now: Date, origem: string): Freshness {
  const age = now.getTime() - new Date(measuredAt).getTime();
  if (origem === "ble_hr" && age <= 5000) return { kind: "ao_vivo" };
  if (age > 24 * 3600_000) return { kind: "sem_dados_recentes", days: Math.floor(age / 86_400_000) };
  return { kind: "atualizado_ha_N_min", minutes: Math.max(0, Math.floor(age / 60_000)) };
}

export function freshnessLabel(f: Freshness): string {
  if (f.kind === "ao_vivo") return "Ao vivo";
  if (f.kind === "sem_dados_recentes") return `Sem dados há ${f.days} ${f.days === 1 ? "dia" : "dias"}`;
  if (f.minutes < 1) return "Atualizado agora há pouco";
  if (f.minutes < 60) return `Atualizado há ${f.minutes} min`;
  return `Atualizado há ${Math.floor(f.minutes / 60)} h`;
}

export type Reading = { metric: string; value: number; measured_at: string; source_device: string };
export type Summary = { last: number; min: number; avg: number; max: number; count: number; lastAt: string; device: string };

/** Resumo de uma métrica dentro da janela [now - janelaMs, now]. Sem leituras: null. */
export function summarize(rows: Reading[], janela: { now: Date; ms: number }): Summary | null {
  const from = janela.now.getTime() - janela.ms;
  const inWin = rows.filter((r) => { const t = new Date(r.measured_at).getTime(); return t >= from && t <= janela.now.getTime() + FUTURE_MS; });
  if (inWin.length === 0) return null;
  const sorted = [...inWin].sort((a, b) => new Date(b.measured_at).getTime() - new Date(a.measured_at).getTime());
  const vals = inWin.map((r) => Number(r.value));
  const first = sorted[0]!;
  return {
    last: Number(first.value), min: Math.min(...vals), max: Math.max(...vals),
    avg: Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10,
    count: vals.length, lastAt: first.measured_at, device: first.source_device,
  };
}

export const WINDOWS = { "24h": 24 * 3600_000, "7d": 7 * 86_400_000, "30d": 30 * 86_400_000 } as const;
export type WindowId = keyof typeof WINDOWS;

/** Heart Rate Measurement (Bluetooth 0x2A37): bit 0 do byte de flags = valor em 16 bits. */
export function parseHeartRateMeasurement(v: DataView): number {
  const flags = v.getUint8(0);
  return flags & 0x01 ? v.getUint16(1, true) : v.getUint8(1);
}

/** Sinais do compartilhamento → métricas lidas. */
export const SIGNAL_METRICS: Record<string, Metric[]> = {
  fc: ["heart_rate", "resting_heart_rate"],
  sono: ["sleep_minutes"],
  spo2: ["spo2"],
  passos: ["steps"],
  pressao: ["bp_systolic", "bp_diastolic"],
  glicose: ["glucose"],
};
export function metricsForSignals(signals: string[]): Metric[] {
  return [...new Set(signals.flatMap((s) => SIGNAL_METRICS[s] ?? []))];
}

export const WEARABLE_RETENTION_DAYS = 365;
export const INGEST_MAX_READINGS = 500;
export const INGEST_RATE_PER_MIN = 60;
export const BLE_SAVE_EVERY_MS = 15_000;

export const SOURCES = {
  apple_health: "Apple Watch / Apple Saúde",
  health_connect: "Android (Health Connect)",
  garmin: "Garmin",
  fitbit: "Fitbit / Google",
  oura: "Oura",
  whoop: "Whoop",
  polar: "Polar",
  ble_hr: "Cinta cardíaca (Bluetooth)",
  outro: "Outro aplicativo",
} as const;
export type Source = keyof typeof SOURCES;

export function connectionStatusText(c: { status: string; last_sync_at: string | null; last_error: string | null }, now: Date): string {
  if (c.status === "revoked") return "Desconectado";
  if (c.status === "error") return `Erro: ${c.last_error || "falha na sincronização"}`;
  if (c.status === "pending") return "Aguardando autorização";
  if (!c.last_sync_at) return "Conectado, ainda sem leituras";
  const f = freshness(c.last_sync_at, now, "sync");
  if (f.kind === "sem_dados_recentes") return `Sem dados há ${f.days} ${f.days === 1 ? "dia" : "dias"}`;
  return `Conectado, última leitura ${agoText(c.last_sync_at, now)}`;
}

/** CSV das leituras, com cabeçalho. */
export function readingsCsv(rows: { metric: string; value: number; unit: string; measured_at: string; source_device: string }[]): string {
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return ["metrica,valor,unidade,medido_em,dispositivo", ...rows.map((r) => [r.metric, String(r.value), r.unit, r.measured_at, esc(r.source_device)].join(","))].join("\n");
}

/** "há 12 min" · "há 3 h" · "há 9 dias" — para "sincronizado há …". */
export function agoText(at: Date | string, now: Date): string {
  const min = Math.max(0, Math.floor((now.getTime() - new Date(at).getTime()) / 60_000));
  if (min < 1) return "há menos de 1 min";
  if (min < 60) return `há ${min} min`;
  if (min < 24 * 60) return `há ${Math.floor(min / 60)} h`;
  const d = Math.floor(min / 1440);
  return `há ${d} ${d === 1 ? "dia" : "dias"}`;
}

/** Medições que a pessoa anota à mão: nomes simples, campos e a tradução para leituras. */
export type ManualKind = "pressao" | "glicose" | "batimentos" | "oxigenio" | "peso" | "temperatura";
export const MANUAL_KINDS: Record<ManualKind, { titulo: string; dica: string; campos: { rotulo: string; metric: Metric; passo: number }[] }> = {
  pressao: { titulo: "Pressão", dica: "Os dois números do aparelho, por exemplo 12 por 8 é 120 e 80.", campos: [{ rotulo: "O número de cima (máxima)", metric: "bp_systolic", passo: 1 }, { rotulo: "O número de baixo (mínima)", metric: "bp_diastolic", passo: 1 }] },
  glicose: { titulo: "Açúcar no sangue", dica: "O número que aparece no aparelho de glicose.", campos: [{ rotulo: "Glicose", metric: "glucose", passo: 1 }] },
  batimentos: { titulo: "Batimentos do coração", dica: "Batimentos por minuto, do relógio ou do aparelho.", campos: [{ rotulo: "Batimentos por minuto", metric: "heart_rate", passo: 1 }] },
  oxigenio: { titulo: "Oxigênio no sangue", dica: "A porcentagem do oxímetro, por exemplo 97.", campos: [{ rotulo: "Oxigênio (%)", metric: "spo2", passo: 1 }] },
  peso: { titulo: "Peso", dica: "O peso da balança em quilos.", campos: [{ rotulo: "Peso (kg)", metric: "weight", passo: 0.1 }] },
  temperatura: { titulo: "Temperatura", dica: "A temperatura do termômetro em graus.", campos: [{ rotulo: "Temperatura (°C)", metric: "temperature", passo: 0.1 }] },
};
export function manualReadings(kind: ManualKind, values: number[], measuredAt: string): ReadingInput[] | null {
  const def = MANUAL_KINDS[kind];
  if (!def || values.length !== def.campos.length) return null;
  return def.campos.map((c, i) => ({ metric: c.metric, value: values[i]!, unit: METRICS[c.metric].unit, measured_at: measuredAt }));
}
