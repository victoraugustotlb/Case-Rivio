import { describe, expect, it } from "vitest";
import { applyEntryIntent, destinationFor, roleRedirect } from "./routing";

describe("destinationFor", () => {
  it.each([
    ["doctor", false, "/clinico"], ["doctor", true, "/clinico"],
    ["laboratory", false, "/clinico"], ["laboratory", true, "/clinico"],
    ["patient_plan", false, "/plano"], ["patient_plan", true, "/inicio"],
    ["patient_individual", false, "/inicio"], ["patient_individual", true, "/inicio"],
    [null, false, "/inicio"], [null, true, "/inicio"],
  ] as const)("%s com vínculo=%s → %s", (accountType, temVinculoPlano, dest) => {
    expect(destinationFor({ accountType, temVinculoPlano })).toBe(dest);
  });
});

describe("roleRedirect", () => {
  it("paciente abre área do paciente; profissional é levado a /clinico", () => {
    expect(roleRedirect("paciente", "patient_plan")).toBeNull();
    expect(roleRedirect("paciente", "patient_individual")).toBeNull();
    expect(roleRedirect("paciente", "doctor")).toBe("/clinico");
    expect(roleRedirect("paciente", "laboratory")).toBe("/clinico");
  });
  it("profissional abre /clinico; paciente é levado a /inicio", () => {
    expect(roleRedirect("profissional", "doctor")).toBeNull();
    expect(roleRedirect("profissional", "laboratory")).toBeNull();
    expect(roleRedirect("profissional", "patient_individual")).toBe("/inicio");
  });
});

describe("applyEntryIntent", () => {
  const now = new Date("2026-01-01T12:00:00Z");
  it("só no primeiro login com Google", () => {
    expect(applyEntryIntent({ provider: "google", createdAt: "2026-01-01T11:55:00Z" }, now)).toBe(true);
    expect(applyEntryIntent({ provider: "google", createdAt: "2025-12-01T11:55:00Z" }, now)).toBe(false);
    expect(applyEntryIntent({ provider: "email", createdAt: "2026-01-01T11:59:00Z" }, now)).toBe(false);
  });
});
