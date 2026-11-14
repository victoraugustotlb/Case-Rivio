import { describe, expect, it } from "vitest";
import { canViewMember, decideFamilyRequest, findHolder, resolveFamily, canShareFor, type FamilyGrant, type FamilyMember, type FamilyMembership } from "./family";

const now = new Date(2026, 10, 14, 12);
const titular: FamilyMember = { id: "t", role: "titular", planId: "p", familyKey: "11112222", birthDate: "1980-01-01" };
const menor: FamilyMember = { id: "m", role: "dependente", planId: "p", familyKey: "11112222", birthDate: "2015-03-10" };
const adulto: FamilyMember = { id: "a", role: "dependente", planId: "p", familyKey: "11112222", birthDate: "1995-05-05" };
const grant = (o: Partial<FamilyGrant> = {}): FamilyGrant => ({ owner_id: "a", viewer_id: "t", scope: "tudo", categories: [], expires_at: null, status: "ativo", revoked_at: null, basis: "consentimento", ...o });

describe("canViewMember", () => {
  it("titular vê menor como responsável legal e pode enviar", () => {
    const d = canViewMember(titular, menor, null, now);
    expect(d).toMatchObject({ allowed: true, basis: "responsavel_legal", canWrite: true });
  });
  it("adulto sem consentimento não é visível", () => {
    expect(canViewMember(titular, adulto, null, now)).toEqual({ allowed: false, reason: "sem_consentimento" });
  });
  it("adulto com consentimento é visível só para leitura", () => {
    expect(canViewMember(titular, adulto, grant({ scope: "categorias", categories: ["Exame"] }), now)).toMatchObject({ allowed: true, basis: "consentimento", canWrite: false, categories: ["Exame"] });
  });
  it("consentimento expirado não vale", () => {
    expect(canViewMember(titular, adulto, grant({ expires_at: new Date(2026, 10, 1).toISOString() }), now)).toEqual({ allowed: false, reason: "expirado" });
  });
  it("consentimento revogado não vale", () => {
    expect(canViewMember(titular, adulto, grant({ status: "revogado", revoked_at: now.toISOString() }), now)).toEqual({ allowed: false, reason: "revogado" });
  });
  it("menor que completa 18 anos passa a exigir consentimento", () => {
    const quase: FamilyMember = { ...menor, birthDate: "2008-11-15" };
    expect(canViewMember(titular, quase, null, now).allowed).toBe(true);
    expect(canViewMember(titular, quase, null, new Date(2026, 10, 15, 9))).toEqual({ allowed: false, reason: "sem_consentimento" });
  });
  it("dependente não vê outro dependente menor sem consentimento", () => {
    expect(canViewMember(adulto, menor, null, now).allowed).toBe(false);
  });
  it("outra família nunca vê", () => {
    expect(canViewMember({ ...titular, familyKey: "99998888" }, menor, null, now)).toEqual({ allowed: false, reason: "outra_familia" });
  });
  it("só responsável legal gera código pelo outro perfil", () => {
    expect(canShareFor(canViewMember(titular, menor, null, now))).toBe(true);
    expect(canShareFor(canViewMember(titular, adulto, grant(), now))).toBe(false);
  });
});

const rows: FamilyMembership[] = [
  { user_id: "t", plan_id: "p", card_number: "11112222", role: "titular", holder_card_number: null, status: "active" },
  { user_id: "m", plan_id: "p", card_number: "33334444", role: "dependente", holder_card_number: "11112222", status: "active" },
  { user_id: "x", plan_id: "p", card_number: "55556666", role: "dependente", holder_card_number: "11112222", status: "pending" },
  { user_id: "o", plan_id: "q", card_number: "11112222", role: "titular", holder_card_number: null, status: "active" },
];
describe("titular e dependentes por carteirinha", () => {
  it("resolve titular e só dependentes ativos do mesmo plano", () => {
    const f = resolveFamily(rows, "p", "11112222");
    expect(f.holder?.user_id).toBe("t");
    expect(f.dependents.map((d) => d.user_id)).toEqual(["m"]);
  });
  it("acha o titular pela carteirinha no plano certo", () => {
    expect(findHolder(rows, "q", "11112222")?.user_id).toBe("o");
    expect(findHolder(rows, "p", "33334444")).toBeNull();
  });
});

describe("aprovação de pedido", () => {
  const req = { holder_id: "t", requester_id: "x", status: "pendente" };
  it("titular aprova ou recusa", () => {
    expect(decideFamilyRequest(req, "t", true)).toEqual({ ok: true, status: "aprovado" });
    expect(decideFamilyRequest(req, "t", false)).toEqual({ ok: true, status: "recusado" });
  });
  it("outra pessoa não decide e pedido respondido não muda", () => {
    expect(decideFamilyRequest(req, "x", true).ok).toBe(false);
    expect(decideFamilyRequest({ ...req, status: "aprovado" }, "t", false).ok).toBe(false);
  });
});
