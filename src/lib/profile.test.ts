import { describe, expect, it } from "vitest";
import { ageFromBirthDate, emptyProfile, profileSchema } from "./profile";

describe("perfil de saúde", () => {
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