import { describe, expect, it } from "vitest";
import { classifyCodeInput, countsAsAttempt, createShareMessage, failureFromError, isRetryable, lookupBlocked, openShareMessage, requestLookupMessage } from "./codes";
import { requestLookupReason } from "./clinic";

describe("classifyCodeInput", () => {
  it("6 números é código de solicitação do médico", () => {
    expect(classifyCodeInput("849201")).toBe("solicitacao");
    expect(classifyCodeInput("849 201")).toBe("solicitacao");
  });
  it("XXXX-XXXX com letras é código do paciente", () => {
    expect(classifyCodeInput("ab7k-9m2p")).toBe("paciente");
    expect(classifyCodeInput("AB7K9M2P")).toBe("paciente");
  });
  it("o resto é inválido", () => {
    expect(classifyCodeInput("12345")).toBe("invalido");
    expect(classifyCodeInput("ABC")).toBe("invalido");
    expect(classifyCodeInput("")).toBe("invalido");
  });
});

describe("mensagens de erro", () => {
  it("cada erro de geração tem texto próprio", () => {
    const m = (["sem_selecao", "falha_servidor", "colisao_esgotada"] as const).map(createShareMessage);
    expect(new Set(m).size).toBe(3);
  });
  it("abertura distingue inexistente, expirado, encerrado, rede e servidor", () => {
    const m = (["invalido", "expirado", "revogado", "rede", "servidor", "bloqueado"] as const).map(openShareMessage);
    expect(new Set(m).size).toBe(6);
    expect(openShareMessage("rede")).toBe("Sem conexão.");
    expect(isRetryable("rede") && isRetryable("servidor") && !isRetryable("expirado")).toBe(true);
  });
  it("falha de fetch ou sem internet é rede; o resto é servidor", () => {
    expect(failureFromError(new TypeError("Failed to fetch"), true)).toBe("rede");
    expect(failureFromError(new Error("boom"), false)).toBe("rede");
    expect(failureFromError(new Error("Internal"), true)).toBe("servidor");
  });
  it("cada motivo do código do médico tem texto próprio", () => {
    const m = (["nao_encontrado", "expirado", "outro_paciente", "ja_respondido", "bloqueado"] as const).map(requestLookupMessage);
    expect(new Set(m).size).toBe(5);
  });
});

describe("contagem de tentativas", () => {
  it("só tentativas que falharam contam", () => {
    expect(countsAsAttempt(true)).toBe(false);
    expect(countsAsAttempt(false)).toBe(true);
  });
  it("bloqueia a partir de 10 falhas", () => {
    expect(lookupBlocked(9)).toBe(false);
    expect(lookupBlocked(10)).toBe(true);
  });
});

describe("motivo do código de solicitação", () => {
  const now = new Date("2026-01-01T12:00:00Z");
  const base = { status: "pending", expires_at: "2026-01-01T12:10:00Z", expected_patient_id: null };
  it("ok enquanto pendente e no prazo", () => expect(requestLookupReason(base, "u1", now)).toBe("ok"));
  it("não encontrado", () => expect(requestLookupReason(null, "u1", now)).toBe("nao_encontrado"));
  it("expirado", () => {
    expect(requestLookupReason({ ...base, expires_at: "2026-01-01T11:00:00Z" }, "u1", now)).toBe("expirado");
    expect(requestLookupReason({ ...base, status: "expired" }, "u1", now)).toBe("expirado");
  });
  it("outro paciente", () => expect(requestLookupReason({ ...base, expected_patient_id: "u2" }, "u1", now)).toBe("outro_paciente"));
  it("já respondido", () => {
    expect(requestLookupReason({ ...base, status: "authorized" }, "u1", now)).toBe("ja_respondido");
    expect(requestLookupReason({ ...base, status: "declined" }, "u1", now)).toBe("ja_respondido");
  });
});
