import { describe, expect, it } from "vitest";
import { accessState, formatShareCode, normalizeCode, profileVisible, validateShare } from "./share";

describe("compartilhamento", () => {
  it("não gera código sem nenhuma informação escolhida", () => {
    expect(validateShare({ categories: [], signals: [], includeProfile: false, periodMonths: 12, validityHours: 24 })).toHaveLength(1);
  });
  it("aceita só sinais de dispositivos, sem documentos", () => {
    expect(validateShare({ categories: [], signals: ["fc"], includeProfile: false, periodMonths: 12, validityHours: 24 })).toEqual([]);
  });
  it("aceita compartilhar somente o perfil, sem documentos ou dispositivos", () => {
    expect(validateShare({ categories: [], signals: [], includeProfile: true, periodMonths: 12, validityHours: 24 })).toEqual([]);
  });
  it("recusa validade fora das opções", () => {
    expect(validateShare({ categories: ["exames"], signals: [], includeProfile: false, periodMonths: 12, validityHours: 999 })).toContain("Validade inválida.");
  });
  it("código tem formato XXXX-XXXX sem 0, O, 1 ou I", () => {
    const c = formatShareCode();
    expect(c).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  });
  it("normaliza código digitado pelo médico", () => {
    expect(normalizeCode(" k7pm 4xq2 ")).toBe("K7PM-4XQ2");
  });
  it("acesso revogado prevalece sobre validade", () => {
    expect(accessState(new Date(Date.now() + 1e6), true)).toBe("revogado");
  });
  it("acesso expira no horário exato", () => {
    const t = new Date("2026-11-13T10:00:00Z");
    expect(accessState(t, false, t)).toBe("expirado");
    expect(accessState(t, false, new Date("2026-11-13T09:59:59Z"))).toBe("valido");
  });
  it("perfil exige consentimento explícito", () => {
    expect(profileVisible({ include_profile: false })).toBe(false);
    expect(profileVisible({ include_profile: true })).toBe(true);
  });
});

import { docVisible as dv } from "./share";
describe("docVisible", () => {
  const now = new Date("2026-11-13T12:00:00Z");
  it("mostra exame autorizado dentro do período", () => {
    expect(dv({ kind: "Exame", created_at: "2026-10-01T00:00:00Z" }, { categories: ["exames"], period_months: 3 }, now)).toBe(true);
  });
  it("esconde categoria não autorizada", () => {
    expect(dv({ kind: "Receita", created_at: "2026-10-01T00:00:00Z" }, { categories: ["exames"], period_months: 3 }, now)).toBe(false);
  });
  it("esconde documento fora do período", () => {
    expect(dv({ kind: "Exame", created_at: "2026-05-01T00:00:00Z" }, { categories: ["exames"], period_months: 3 }, now)).toBe(false);
  });
});
