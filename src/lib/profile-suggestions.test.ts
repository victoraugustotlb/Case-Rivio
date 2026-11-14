import { describe, expect, it } from "vitest";
import { emptyProfile } from "./profile";
import { applySuggestion, cleanSuggestions, suggestionConflict } from "./profile-suggestions";

describe("cleanSuggestions", () => {
  it("descarta valores sem citação literal", () => {
    expect(cleanSuggestions({ tipo_sanguineo: { valor: "O+", trecho: "", confianca: 0.9 }, alergias: [], medicamentos: [], condicoes: [], altura_cm: null, peso_kg: null })).toEqual([]);
  });
  it("mantém o que tem trecho e está na faixa", () => {
    const r = cleanSuggestions({ tipo_sanguineo: { valor: "O+", trecho: "Grupo sanguíneo: O Rh+", confianca: 0.95 }, alergias: [{ valor: "Dipirona", trecho: "Alérgico a dipirona", confianca: 2 }], medicamentos: [], condicoes: [], altura_cm: { valor: 900, trecho: "900", confianca: 1 }, peso_kg: null });
    expect(r.map((x) => x.field)).toEqual(["blood_type", "allergies"]);
    expect(r[1]?.confidence).toBe(1);
  });
  it("documento sem dados não gera nada", () => expect(cleanSuggestions({ tipo_sanguineo: null, alergias: [], medicamentos: [], condicoes: [], altura_cm: null, peso_kg: null })).toEqual([]));
});

describe("applySuggestion", () => {
  it("não sobrescreve valor diferente sem escolha explícita", () => {
    const p = { ...emptyProfile, blood_type: "A+" as const };
    expect(suggestionConflict(p, { field: "blood_type", value: "O+" })).toBe("A+");
    expect(applySuggestion(p, { field: "blood_type", value: "O+" }, false).ok).toBe(false);
    const r = applySuggestion(p, { field: "blood_type", value: "O+" }, true);
    expect(r.ok && r.profile.blood_type).toBe("O+");
  });
  it("alergia é acrescentada sem duplicar", () => {
    const r = applySuggestion({ ...emptyProfile, allergies: "Látex" }, { field: "allergies", value: "látex" }, false);
    expect(r.ok && r.profile.allergies).toBe("Látex");
    const r2 = applySuggestion({ ...emptyProfile, allergies: "Látex" }, { field: "allergies", value: "Penicilina" }, false);
    expect(r2.ok && r2.profile.allergies).toBe("Látex\nPenicilina");
  });
  it("medicamento entra na lista", () => {
    const r = applySuggestion(emptyProfile, { field: "medications", value: { name: "Losartana", dose: "50 mg", frequency: "1x/dia" } }, false);
    expect(r.ok && r.profile.medications).toHaveLength(1);
  });
});
