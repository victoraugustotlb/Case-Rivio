import { describe, expect, it } from "vitest";
import { haeDateToIso, mapHealthAutoExport } from "./health-auto-export";

const wrap = (metrics: unknown[]) => ({ data: { metrics } });

describe("haeDateToIso", () => {
  it("converte o formato do app para ISO com fuso", () => {
    expect(haeDateToIso("2024-02-06 14:30:00 -0800")).toBe("2024-02-06T14:30:00-08:00");
    expect(haeDateToIso("2024-02-06 14:30:00 +0530")).toBe("2024-02-06T14:30:00+05:30");
  });
  it("recusa texto fora do formato", () => {
    expect(haeDateToIso("hoje")).toBeNull();
    expect(haeDateToIso(123)).toBeNull();
    expect(haeDateToIso("2024-13-45 99:99:99 -0800")).toBeNull();
  });
});

describe("mapHealthAutoExport", () => {
  it("não reconhece o formato próprio do Anamedis", () => {
    expect(mapHealthAutoExport({ device: { name: "x" }, readings: [] })).toBeNull();
    expect(mapHealthAutoExport(null)).toBeNull();
  });
  it("frequência cardíaca usa a média e o nome do aparelho", () => {
    const r = mapHealthAutoExport(wrap([{ name: "heart_rate", units: "count/min", data: [{ date: "2024-02-06 14:30:00 -0800", Min: 65, Avg: 72, Max: 85, source: "Apple Watch" }] }]))!;
    expect(r.device).toBe("Apple Watch");
    expect(r.readings).toEqual([{ metric: "heart_rate", value: 72, unit: "bpm", measured_at: "2024-02-06T14:30:00-08:00" }]);
  });
  it("pressão vira duas leituras", () => {
    const r = mapHealthAutoExport(wrap([{ name: "blood_pressure", units: "mmHg", data: [{ date: "2024-02-06 14:30:00 -0800", systolic: 120, diastolic: 80, source: "Health" }] }]))!;
    expect(r.readings.map((x) => [x.metric, x.value])).toEqual([["bp_systolic", 120], ["bp_diastolic", 80]]);
  });
  it("glicose só em mg/dL", () => {
    const ok = mapHealthAutoExport(wrap([{ name: "blood_glucose", units: "mg/dL", data: [{ date: "2024-02-06 08:00:00 -0800", qty: 95, source: "Health" }] }]))!;
    expect(ok.readings[0]).toMatchObject({ metric: "glucose", value: 95, unit: "mg/dL" });
    const mmol = mapHealthAutoExport(wrap([{ name: "blood_glucose", units: "mmol/L", data: [{ date: "2024-02-06 08:00:00 -0800", qty: 5.3 }] }]))!;
    expect(mmol.readings).toEqual([]);
  });
  it("passos só entram como total do dia (meia-noite)", () => {
    const parcial = mapHealthAutoExport(wrap([{ name: "step_count", units: "count", data: [{ qty: 8500, date: "2024-02-06 14:30:00 -0800", source: "Apple Watch" }] }]))!;
    expect(parcial.readings).toEqual([]);
    const dia = mapHealthAutoExport(wrap([{ name: "step_count", units: "count", data: [{ qty: 8500, date: "2024-02-06 00:00:00 -0800" }] }]))!;
    expect(dia.readings[0]).toMatchObject({ metric: "steps", value: 8500, unit: "passos" });
  });
  it("sono do dia vira minutos", () => {
    const r = mapHealthAutoExport(wrap([{ name: "sleep_analysis", units: "hr", data: [{ date: "2024-02-06 00:00:00 -0800", totalSleep: 7.5, source: "Apple Watch" }] }]))!;
    expect(r.readings[0]).toMatchObject({ metric: "sleep_minutes", value: 450, unit: "min" });
  });
  it("métricas desconhecidas são listadas e ignoradas, sem derrubar o resto", () => {
    const r = mapHealthAutoExport(wrap([{ name: "walking_speed", units: "km/hr", data: [{ qty: 4, date: "2024-02-06 14:30:00 -0800" }] }, { name: "heart_rate", units: "count/min", data: [{ date: "2024-02-06 14:30:00 -0800", Avg: 70 }] }]))!;
    expect(r.ignoredMetrics).toEqual(["walking_speed"]);
    expect(r.readings).toHaveLength(1);
    expect(r.device).toBe("Apple Saúde");
  });
  it("itens com data inválida ou valores ausentes são pulados", () => {
    const r = mapHealthAutoExport(wrap([{ name: "heart_rate", units: "count/min", data: [{ date: "ontem", Avg: 70 }, { date: "2024-02-06 14:30:00 -0800" }] }]))!;
    expect(r.readings).toEqual([]);
  });
});
