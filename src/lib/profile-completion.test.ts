import { describe, expect, it } from "vitest";
import { emptyProfile, parseProfileLenient, type HealthProfile } from "./profile";
import { bmi, clearNoneWhenFilled, completion, completionCardHidden, fieldState, filterEssentials, stampSources } from "./profile-completion";
import { DEFAULT_SHARE_ESSENTIALS, essentialsVisible, validateShare } from "./share";

const p = (o: Partial<HealthProfile> = {}): HealthProfile => ({ ...emptyProfile, ...o });

describe("fieldState", () => {
  it("vazio é não informado, nunca nenhum", () => expect(fieldState(p(), "alergias")).toBe("nao_informado"));
  it("só vira nenhum quando o paciente confirmou", () => expect(fieldState(p({ confirmed_none: ["alergias"] }), "alergias")).toBe("nenhum_confirmado"));
  it("preenchido vence a confirmação", () => expect(fieldState(p({ allergies: "Dipirona", confirmed_none: ["alergias"] }), "alergias")).toBe("preenchido"));
  it("sem perfil é não informado", () => expect(fieldState(null, "nome")).toBe("nao_informado"));
});

describe("completion", () => {
  it("perfil vazio: 0 de 12, faltando em ordem clínica", () => {
    const c = completion(p());
    expect(c).toMatchObject({ feitos: 0, total: 12, percentual: 0 });
    expect(c.faltando.slice(0, 8)).toEqual(["alergias", "medicamentos", "tipo_sanguineo", "condicoes", "contato_emergencia", "altura", "peso", "nascimento"]);
  });
  it("altura e peso contam também o IMC", () => {
    expect(completion(p({ height_cm: 170, weight_kg: 70 })).feitos).toBe(3);
  });
  it("nenhum confirmado conta como respondido", () => {
    const c = completion(p({ confirmed_none: ["alergias", "medicamentos"] }));
    expect(c.feitos).toBe(2);
    expect(c.faltando[0]).toBe("tipo_sanguineo");
  });
});

describe("bmi", () => {
  it("calcula com uma casa", () => expect(bmi(170, 70)).toEqual({ value: 24.2, range: "adequado" }));
  it("faixas informativas", () => { expect(bmi(170, 50)?.range).toBe("abaixo"); expect(bmi(170, 80)?.range).toBe("acima"); expect(bmi(170, 95)?.range).toBe("bem_acima"); });
  it("sem dado não calcula", () => expect(bmi(null, 70)).toBeNull());
});

describe("filterEssentials", () => {
  const prof = p({ full_name: "Ana", blood_type: "O+", allergies: "", confirmed_none: ["alergias"], field_sources: { blood_type: { origem: "documento", documento_id: "d1", atualizado_em: "2026-03-12T00:00:00Z" }, "none:alergias": { origem: "paciente", atualizado_em: "2026-04-01T00:00:00Z" } } });
  it("devolve só os campos autorizados", () => expect(filterEssentials(prof, ["nome", "tipo_sanguineo"]).map((e) => e.field)).toEqual(["nome", "tipo_sanguineo"]));
  it("nunca inventa: vazio volta sem valor", () => expect(filterEssentials(prof, ["peso"])[0]).toMatchObject({ state: "nao_informado", value: "" }));
  it("nenhum confirmado traz a data", () => expect(filterEssentials(prof, ["alergias"])[0]).toMatchObject({ state: "nenhum_confirmado", confirmedAt: "2026-04-01T00:00:00Z" }));
  it("traz a origem do campo", () => expect(filterEssentials(prof, ["tipo_sanguineo"])[0]?.source?.origem).toBe("documento"));
  it("sem autorização não sai nada", () => expect(filterEssentials(prof, [])).toEqual([]));
});

describe("stampSources", () => {
  const now = new Date("2026-11-14T12:00:00Z");
  it("marca só o que mudou", () => {
    const s = stampSources(p(), p({ blood_type: "A+" }), { origem: "paciente" }, now);
    expect(Object.keys(s)).toEqual(["blood_type"]);
  });
  it("cuidador guarda o valor anterior para desfazer", () => {
    const s = stampSources(p({ weight_kg: 30 }), p({ weight_kg: 32 }), { origem: "cuidador", por_nome: "Maria" }, now);
    expect(s["weight_kg"]).toMatchObject({ origem: "cuidador", por_nome: "Maria", anterior: 30 });
  });
  it("registra a data do 'não tenho'", () => {
    expect(stampSources(p(), p({ confirmed_none: ["cirurgias"] }), { origem: "paciente" }, now)["none:cirurgias"]?.atualizado_em).toBe(now.toISOString());
  });
  it("preencher remove o 'não tenho'", () => expect(clearNoneWhenFilled(p({ allergies: "Látex", confirmed_none: ["alergias", "cirurgias"] })).confirmed_none).toEqual(["cirurgias"]));
});

describe("perfil antigo continua compatível", () => {
  it("linha sem as colunas novas é lida com padrões", () => {
    const { profile } = parseProfileLenient({ ...emptyProfile, blood_type: undefined, sex: undefined, field_sources: undefined, emergency_contacts: undefined, confirmed_none: undefined, organ_donor: undefined });
    expect(profile).toMatchObject({ blood_type: "", emergency_contacts: [], confirmed_none: [] });
  });
});

describe("compartilhamento da ficha", () => {
  it("padrão é compartilhar a ficha", () => expect(DEFAULT_SHARE_ESSENTIALS).toBe(true));
  it("só a ficha é um pedido válido", () => expect(validateShare({ categories: [], signals: [], includeProfile: false, includeEssentials: true, periodMonths: 12, validityHours: 24 })).toEqual([]));
  it("sem nada continua inválido", () => expect(validateShare({ categories: [], signals: [], includeProfile: false, includeEssentials: false, periodMonths: 12, validityHours: 24 })).toHaveLength(1));
  it("códigos antigos não mostram ficha", () => expect(essentialsVisible({ include_essentials: false, essentials_fields: ["nome"] })).toEqual([]));
  it("código novo mostra o retrato dos campos", () => expect(essentialsVisible({ include_essentials: true, essentials_fields: ["nome", "alergias"] })).toEqual(["nome", "alergias"]));
});

describe("cartão em /inicio", () => {
  const now = new Date("2026-11-14T12:00:00Z");
  it("uma dispensa não esconde", () => expect(completionCardHidden(["2026-11-13T00:00:00Z"], now)).toBe(false));
  it("duas dispensas escondem por 30 dias", () => expect(completionCardHidden(["2026-11-01T00:00:00Z", "2026-11-13T00:00:00Z"], now)).toBe(true));
  it("volta depois de 30 dias", () => expect(completionCardHidden(["2026-09-01T00:00:00Z", "2026-10-01T00:00:00Z"], now)).toBe(false));
});
