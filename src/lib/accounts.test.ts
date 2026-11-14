import { describe, expect, it } from "vitest";
import { canShareRecords, canWriteRecords, homeFor, isCardNumber, membershipRules, subscriptionState } from "./accounts";

const now = new Date("2026-11-14T12:00:00Z");
describe("carteirinha", () => {
  it("aceita 8 a 20 dígitos com separadores", () => { expect(isCardNumber("0123 4567 8901")).toBe(true); expect(isCardNumber("123.456.78")).toBe(true); });
  it("recusa letras, curtas e longas", () => { expect(isCardNumber("ABC12345")).toBe(false); expect(isCardNumber("1234567")).toBe(false); expect(isCardNumber("1".repeat(21))).toBe(false); });
});
describe("titular e dependente", () => {
  it("titular fica ativo sem carteirinha do titular", () => expect(membershipRules("titular", "12345678", null)).toEqual({ errors: [], status: "active", holder: null }));
  it("dependente fica pendente e guarda a carteirinha do titular", () => expect(membershipRules("dependente", "12345678", "8765 4321")).toEqual({ errors: [], status: "pending", holder: "87654321" }));
  it("dependente sem titular ou com a própria carteirinha é recusado", () => {
    expect(membershipRules("dependente", "12345678", "").errors.length).toBe(1);
    expect(membershipRules("dependente", "12345678", "1234-5678").errors).toEqual(["A carteirinha do titular deve ser diferente da sua."]);
  });
});
describe("assinatura", () => {
  it("ativa, cancelando e vencida", () => {
    expect(subscriptionState({ status: "active", current_period_end: "2026-12-14T00:00:00Z", cancel_at_period_end: false }, now)).toBe("ativa");
    expect(subscriptionState({ status: "active", current_period_end: "2026-12-14T00:00:00Z", cancel_at_period_end: true }, now)).toBe("cancelando");
    expect(subscriptionState({ status: "active", current_period_end: "2026-11-01T00:00:00Z", cancel_at_period_end: false }, now)).toBe("vencida");
    expect(subscriptionState({ status: "canceled", current_period_end: "2026-12-14T00:00:00Z", cancel_at_period_end: false }, now)).toBe("vencida");
    expect(subscriptionState(null, now)).toBe("sem_assinatura");
  });
  it("vencida bloqueia envio; isenta e cancelando no período não bloqueiam", () => {
    const venc = { status: "past_due", current_period_end: "2026-11-01T00:00:00Z", cancel_at_period_end: false };
    expect(canWriteRecords({ type: "patient_individual", exempt: false, membershipStatus: null, sub: venc }, now)).toBe(false);
    expect(canWriteRecords({ type: "patient_individual", exempt: true, membershipStatus: null, sub: null }, now)).toBe(true);
    expect(canWriteRecords({ type: "patient_individual", exempt: false, membershipStatus: null, sub: { ...venc, status: "active", current_period_end: "2026-12-01T00:00:00Z", cancel_at_period_end: true } }, now)).toBe(true);
  });
  it("plano: só vínculo ativo envia; dependente pendente não", () => {
    expect(canWriteRecords({ type: "patient_plan", exempt: false, membershipStatus: "active", sub: null })).toBe(true);
    expect(canWriteRecords({ type: "patient_plan", exempt: false, membershipStatus: "pending", sub: null })).toBe(false);
  });
});
describe("destino após o login", () => {
  it("profissionais vão ao painel; pacientes ao início", () => {
    expect(homeFor("doctor")).toBe("/clinico"); expect(homeFor("laboratory")).toBe("/clinico");
    expect(homeFor("patient_plan")).toBe("/inicio"); expect(homeFor("patient_individual")).toBe("/inicio");
  });
  it("compartilhar não depende de cobrança: paciente sem plano nem assinatura gera códigos", () => {
    expect(canWriteRecords({ type: "patient_individual", exempt: false, membershipStatus: null, sub: null })).toBe(false);
    expect(canShareRecords("patient_individual")).toBe(true);
    expect(canShareRecords("patient_plan")).toBe(true);
    expect(canShareRecords("doctor")).toBe(false);
  });
});
