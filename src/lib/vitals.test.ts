import { describe, expect, it } from "vitest";
import { classifyBloodPressure, classifyGlucose, classifyHeartRate, classifyRestingHeartRate, classifySpo2 } from "./vitals";

describe("faixas de sinais vitais", () => {
  it("pressão 120/80 é normal, 132/84 atenção, 145/92 alerta", () => {
    expect(classifyBloodPressure(120, 80)).toBe("normal");
    expect(classifyBloodPressure(132, 84)).toBe("atencao");
    expect(classifyBloodPressure(145, 92)).toBe("alerta");
  });
  it("frequência 72 normal, 105 atenção, 120 alerta", () => {
    expect(classifyHeartRate(72)).toBe("normal");
    expect(classifyHeartRate(105)).toBe("atencao");
    expect(classifyHeartRate(120)).toBe("alerta");
  });
  it("glicemia 92 normal, 110 atenção, 130 alerta", () => {
    expect(classifyGlucose(92)).toBe("normal");
    expect(classifyGlucose(110)).toBe("atencao");
    expect(classifyGlucose(130)).toBe("alerta");
  });
});

describe("sinais de dispositivo (informativos)", () => {
  it("SpO₂: 97 normal, 93 atenção, 88 alerta", () => {
    expect(classifySpo2(97)).toBe("normal"); expect(classifySpo2(93)).toBe("atencao"); expect(classifySpo2(88)).toBe("alerta");
  });
  it("FC em repouso: 65 normal, 95 atenção, 105 alerta, 38 alerta", () => {
    expect(classifyRestingHeartRate(65)).toBe("normal"); expect(classifyRestingHeartRate(95)).toBe("atencao");
    expect(classifyRestingHeartRate(105)).toBe("alerta"); expect(classifyRestingHeartRate(38)).toBe("alerta");
  });
});
