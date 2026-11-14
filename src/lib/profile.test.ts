import { describe, expect, it } from "vitest";
import { ageFromBirthDate, emptyProfile, parseProfileLenient, profileSchema } from "./profile";

describe("perfil de saúde", () => {
  it("perfil com valores antigos abre com os campos válidos e marca incompleto", () => {
    const r = parseProfileLenient({ ...emptyProfile, full_name: "Ana", smoking: "Fumante", alcohol: "Ocasionalmente", activity: 3, medications: [{ name: "Remédio de teste", dose: "1", frequency: "1x" }, { dose: "sem nome" }] });
    expect(r.incomplete).toBe(true);
    expect(r.profile.full_name).toBe("Ana");
    expect(r.profile.alcohol).toBe("Ocasionalmente");
    expect(r.profile.smoking).toBe("");
    expect(r.profile.activity).toBe("");
    expect(r.profile.medications).toHaveLength(1);
    expect(r.invalid).toEqual(expect.arrayContaining(["smoking", "activity", "medications"]));
  });
  it("perfil válido não é marcado como incompleto", () => {
    expect(parseProfileLenient(emptyProfile)).toEqual({ profile: emptyProfile, incomplete: false, invalid: [] });
  });
  it("perfil sem nenhum dado legível volta vazio, sem erro", () => {
    expect(parseProfileLenient(null).profile).toEqual(emptyProfile);
  });
  it("calcula a idade pela data de nascimento, antes do aniversário", () => {
    expect(ageFromBirthDate("1990-11-15", new Date(2026, 10, 14))).toBe(35);
  });
  it("atualiza a idade no aniversário", () => {
    expect(ageFromBirthDate("1990-11-14", new Date(2026, 10, 14))).toBe(36);
  });
  it("mantém medidas e histórico opcionais", () => {
    expect(profileSchema.safeParse(emptyProfile).success).toBe(true);
  });
  it("preserva altura, peso e medicamentos informados", () => {
    const profile = profileSchema.parse({ ...emptyProfile, height_cm: 172, weight_kg: 68.5, medications: [{ name: "Medicamento de teste", dose: "10 mg", frequency: "Uma vez ao dia" }] });
    expect(profile.height_cm).toBe(172);
    expect(profile.weight_kg).toBe(68.5);
    expect(profile.medications[0]?.dose).toBe("10 mg");
  });
  it("rejeita data futura e data inexistente", () => {
    expect(profileSchema.safeParse({ ...emptyProfile, birth_date: "2999-01-01" }).success).toBe(false);
    expect(ageFromBirthDate("2025-02-30")).toBeNull();
  });
  it("rejeita medidas inválidas e medicamentos sem nome", () => {
    expect(profileSchema.safeParse({ ...emptyProfile, height_cm: -1 }).success).toBe(false);
    expect(profileSchema.safeParse({ ...emptyProfile, weight_kg: 0 }).success).toBe(false);
    expect(profileSchema.safeParse({ ...emptyProfile, medications: [{ name: "", dose: "", frequency: "" }] }).success).toBe(false);
  });
  it("não aceita que o formulário substitua o dono do perfil", () => {
    const profile = profileSchema.parse({ ...emptyProfile, user_id: "outra-pessoa" });
    expect(profile).not.toHaveProperty("user_id");
  });
});