import { describe, expect, it } from "vitest";
import { parseReference } from "./reference";

describe("referência impressa no laudo", () => {
  it("acima de faixa fechada", () => expect(parseReference("112 mg/dL (70 a 99)").status).toBe("acima"));
  it("dentro de faixa fechada", () => expect(parseReference("85 mg/dL (70 a 99)").status).toBe("normal"));
  it("abaixo de faixa fechada", () => expect(parseReference("65 mg/dL (70 a 99)").status).toBe("abaixo"));
  it("limite superior 'inferior a'", () => {
    expect(parseReference("145 mg/dL — desejável: inferior a 130").status).toBe("acima");
    expect(parseReference("110 mg/dL (inferior a 130)").status).toBe("normal");
  });
  it("limite inferior 'superior a'", () => {
    expect(parseReference("42 mg/dL (superior a 50)").status).toBe("abaixo");
    expect(parseReference("55 mg/dL (superior a 50)").status).toBe("normal");
  });
  it("decimais com vírgula", () => expect(parseReference("5,8 % (4,0 a 5,6)")).toMatchObject({ status: "acima", value: 5.8, min: 4, max: 5.6 }));
  it("sem faixa ou qualitativo fica indeterminado", () => {
    expect(parseReference("98 mg/dL").status).toBe("indeterminado");
    expect(parseReference("Não reagente").status).toBe("indeterminado");
  });
});
