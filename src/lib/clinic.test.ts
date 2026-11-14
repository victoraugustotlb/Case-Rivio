import { describe, expect, it } from "vitest";
import { formatRequestCode, generateRequestCode, isRequestCode, normalizeRequestCode, patientRef, requestOpen } from "./clinic";

describe("solicitações do médico", () => {
  it("gera código de 6 dígitos numéricos", () => {
    for (let i = 0; i < 50; i++) expect(generateRequestCode()).toMatch(/^[0-9]{6}$/);
  });
  it("aceita só 6 dígitos e ignora espaços", () => {
    expect(normalizeRequestCode("849 201")).toBe("849201");
    expect(isRequestCode("84920")).toBe(false);
    expect(isRequestCode("84920A")).toBe(false);
    expect(formatRequestCode("849201")).toBe("849 201");
  });
  it("expira após a validade ou quando já respondida", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    expect(requestOpen({ status: "pending", expires_at: "2026-01-01T12:10:00Z" }, now)).toBe(true);
    expect(requestOpen({ status: "pending", expires_at: "2026-01-01T11:59:00Z" }, now)).toBe(false);
    expect(requestOpen({ status: "authorized", expires_at: "2026-01-01T12:10:00Z" }, now)).toBe(false);
  });
  it("ID do paciente não expõe o identificador completo", () => {
    expect(patientRef("1544b77c-3075-4c0d-b265-7cb59532259e")).toBe("AM-1544B77C");
  });
});
