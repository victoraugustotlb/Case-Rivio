import { describe, expect, it } from "vitest";
import { accessActive, canUpload, displayRequestStatus, docVisibleToOthers, endedState, nextRequestStatus, normalizePatientRef } from "./clinic";
import { docVisible } from "./share";

const now = new Date("2026-11-14T12:00:00Z");
const future = "2026-11-14T13:00:00Z", past = "2026-11-14T11:00:00Z";
const acc = (o: Partial<Parameters<typeof canUpload>[0]> = {}) => ({ status: "authorized", upload_granted: true, share: { expires_at: future, revoked: false }, ...o });

describe("canUpload", () => {
  it("permite com permissão e acesso ativo", () => expect(canUpload(acc(), now)).toBe(true));
  it("nega sem permissão de envio", () => expect(canUpload(acc({ upload_granted: false }), now)).toBe(false));
  it("nega com permissão vencida junto com o acesso", () => expect(canUpload(acc({ share: { expires_at: past, revoked: false } }), now)).toBe(false));
  it("nega com acesso revogado", () => expect(canUpload(acc({ share: { expires_at: future, revoked: true } }), now)).toBe(false));
  it("nega se a solicitação não foi autorizada", () => expect(canUpload(acc({ status: "declined" }), now)).toBe(false));
});

describe("acesso ativo e histórico", () => {
  it("ativo só autorizado e dentro da validade", () => {
    expect(accessActive(acc(), now)).toBe(true);
    expect(accessActive(acc({ share: null }), now)).toBe(false);
  });
  it("estado encerrado", () => {
    expect(endedState(acc({ status: "declined", share: null }), now)).toBe("recusado");
    expect(endedState(acc({ share: { expires_at: future, revoked: true } }), now)).toBe("revogado");
    expect(endedState(acc({ share: { expires_at: past, revoked: false } }), now)).toBe("expirado");
  });
});

describe("documento pendente fora de códigos", () => {
  const share = { categories: ["laudos"], period_months: 12 };
  it("pendente e recusado não entram", () => {
    expect(docVisible({ kind: "Laudo", created_at: "2026-11-01T00:00:00Z", status: "pending_patient" }, share, now)).toBe(false);
    expect(docVisible({ kind: "Laudo", created_at: "2026-11-01T00:00:00Z", status: "rejected" }, share, now)).toBe(false);
    expect(docVisibleToOthers({ status: "pending_patient" })).toBe(false);
  });
  it("aceito entra", () => {
    expect(docVisible({ kind: "Laudo", created_at: "2026-11-01T00:00:00Z", status: "accepted" }, share, now)).toBe(true);
  });
});

describe("estados da solicitação", () => {
  it("pendente pode ir para autorizada, recusada ou expirada", () => {
    expect(nextRequestStatus("pending", "authorize")).toBe("authorized");
    expect(nextRequestStatus("pending", "decline")).toBe("declined");
    expect(nextRequestStatus("pending", "expire")).toBe("expired");
  });
  it("estados finais não mudam", () => {
    expect(nextRequestStatus("authorized", "decline")).toBeNull();
    expect(nextRequestStatus("declined", "authorize")).toBeNull();
    expect(nextRequestStatus("expired", "authorize")).toBeNull();
  });
  it("pendente vencida aparece como expirada", () => {
    expect(displayRequestStatus({ status: "pending", expires_at: past }, now)).toBe("expired");
    expect(displayRequestStatus({ status: "pending", expires_at: future }, now)).toBe("pending");
  });
  it("normaliza ID do paciente", () => expect(normalizePatientRef("am 1544b77c")).toBe("AM-1544B77C"));
});
