import { describe, expect, it } from "vitest";
import { classifyBloodPressure, classifyGlucose, classifyHeartRate } from "./vitals";

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
