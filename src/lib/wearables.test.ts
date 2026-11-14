import { describe, expect, it } from "vitest";
import { agoText, connectionStatusText, freshness, freshnessLabel, metricsForSignals, parseHeartRateMeasurement, readingsCsv, summarize, validateReading } from "./wearables";

const now = new Date("2026-11-14T12:00:00Z");
const r = (o: Partial<{ metric: string; value: number; unit: string; measured_at: string }>) => ({ metric: "heart_rate", value: 72, unit: "bpm", measured_at: "2026-11-14T11:59:00Z", ...o });

describe("validateReading", () => {
  it("aceita leitura plausível", () => expect(validateReading(r({}), now)).toEqual({ ok: true }));
  it("métrica desconhecida", () => expect(validateReading(r({ metric: "mood" }), now)).toEqual({ ok: false, reason: "metrica_invalida" }));
  it("unidade errada", () => expect(validateReading(r({ unit: "bps" }), now)).toEqual({ ok: false, reason: "unidade_invalida" }));
  it("faixas: FC 20–250, SpO₂ 50–100, temperatura 30–45", () => {
    expect(validateReading(r({ value: 19 }), now)).toMatchObject({ reason: "fora_da_faixa" });
    expect(validateReading(r({ value: 251 }), now)).toMatchObject({ reason: "fora_da_faixa" });
    expect(validateReading(r({ value: 250 }), now)).toEqual({ ok: true });
    expect(validateReading(r({ metric: "spo2", unit: "%", value: 101 }), now)).toMatchObject({ reason: "fora_da_faixa" });
    expect(validateReading(r({ metric: "temperature", unit: "°C", value: 29.9 }), now)).toMatchObject({ reason: "fora_da_faixa" });
    expect(validateReading(r({ metric: "steps", unit: "passos", value: 100001 }), now)).toMatchObject({ reason: "fora_da_faixa" });
  });
  it("data mais de 5 min no futuro é recusada; 4 min passa", () => {
    expect(validateReading(r({ measured_at: "2026-11-14T12:06:00Z" }), now)).toMatchObject({ reason: "data_futura" });
    expect(validateReading(r({ measured_at: "2026-11-14T12:04:00Z" }), now)).toEqual({ ok: true });
  });
  it("mais de 2 anos atrás é antiga", () => expect(validateReading(r({ measured_at: "2024-11-01T00:00:00Z" }), now)).toMatchObject({ reason: "data_antiga" }));
});

describe("freshness", () => {
  it("ao vivo só para Bluetooth até 5 s", () => {
    expect(freshness("2026-11-14T11:59:57Z", now, "ble_hr")).toEqual({ kind: "ao_vivo" });
    expect(freshness("2026-11-14T11:59:57Z", now, "sync").kind).toBe("atualizado_ha_N_min");
    expect(freshness("2026-11-14T11:59:50Z", now, "ble_hr").kind).toBe("atualizado_ha_N_min");
  });
  it("minutos e mais de 24 h", () => {
    expect(freshness("2026-11-14T11:48:00Z", now, "sync")).toEqual({ kind: "atualizado_ha_N_min", minutes: 12 });
    expect(freshness("2026-11-05T12:00:00Z", now, "sync")).toEqual({ kind: "sem_dados_recentes", days: 9 });
  });
  it("nunca escreve 'tempo real'", () => {
    for (const f of [freshness(now, now, "ble_hr"), freshness("2026-11-14T11:00:00Z", now, "sync"), freshness("2026-11-01T00:00:00Z", now, "sync")]) expect(freshnessLabel(f).toLowerCase()).not.toContain("tempo real");
  });
});

describe("summarize", () => {
  const rows = [
    { metric: "heart_rate", value: 60, measured_at: "2026-11-14T10:00:00Z", source_device: "Apple Watch" },
    { metric: "heart_rate", value: 80, measured_at: "2026-11-14T11:00:00Z", source_device: "Apple Watch" },
    { metric: "heart_rate", value: 70, measured_at: "2026-11-10T11:00:00Z", source_device: "Garmin" },
  ];
  it("janela de 24 h", () => expect(summarize(rows, { now, ms: 86_400_000 })).toEqual({ last: 80, min: 60, avg: 70, max: 80, count: 2, lastAt: "2026-11-14T11:00:00Z", device: "Apple Watch" }));
  it("janela de 7 dias inclui a mais antiga", () => expect(summarize(rows, { now, ms: 7 * 86_400_000 })?.count).toBe(3));
  it("sem leituras: null (nunca inventa)", () => expect(summarize([], { now, ms: 86_400_000 })).toBeNull());
});

describe("parseHeartRateMeasurement", () => {
  it("formato 8 bits (flag bit 0 = 0)", () => expect(parseHeartRateMeasurement(new DataView(new Uint8Array([0x00, 72]).buffer))).toBe(72));
  it("formato 16 bits little-endian (flag bit 0 = 1)", () => expect(parseHeartRateMeasurement(new DataView(new Uint8Array([0x01, 0x2c, 0x01]).buffer))).toBe(300));
  it("ignora outros bits de flag", () => expect(parseHeartRateMeasurement(new DataView(new Uint8Array([0x16, 95, 0, 0]).buffer))).toBe(95));
});

describe("auxiliares", () => {
  it("sinais → métricas", () => expect(metricsForSignals(["fc", "pressao"])).toEqual(["heart_rate", "resting_heart_rate", "bp_systolic", "bp_diastolic"]));
  it("estado da conexão", () => {
    expect(connectionStatusText({ status: "connected", last_sync_at: "2026-11-14T11:48:00Z", last_error: null }, now)).toBe("Conectado, última leitura há 12 min");
    expect(connectionStatusText({ status: "connected", last_sync_at: "2026-11-05T12:00:00Z", last_error: null }, now)).toBe("Sem dados há 9 dias");
    expect(connectionStatusText({ status: "error", last_sync_at: null, last_error: "token expirado" }, now)).toBe("Erro: token expirado");
  });
  it("agoText", () => expect(agoText("2026-11-14T09:00:00Z", now)).toBe("há 3 h"));
  it("CSV com cabeçalho e escape", () => expect(readingsCsv([{ metric: "heart_rate", value: 72, unit: "bpm", measured_at: "x", source_device: "A, B" }])).toBe('metrica,valor,unidade,medido_em,dispositivo\nheart_rate,72,bpm,x,"A, B"'));
});
