// Os dois códigos do Anamedis e as mensagens de erro de cada um — funções puras, testadas em codes.test.ts.

/** "paciente" = XXXX-XXXX (letras e números, gerado pelo paciente); "solicitacao" = 6 números (gerado pelo médico). */
export type CodeKind = "paciente" | "solicitacao" | "invalido";
export const PATIENT_CODE_LABEL = "Código do paciente (letras e números)";
export const REQUEST_CODE_LABEL = "Código de solicitação do médico (6 números)";

export function classifyCodeInput(text: string): CodeKind {
  const raw = text.toUpperCase().replace(/[\s-]/g, "");
  if (/^[0-9]{6}$/.test(raw)) return "solicitacao";
  if (/^[A-Z0-9]{8}$/.test(raw) && /[A-Z]/.test(raw)) return "paciente";
  return "invalido";
}

/** Erros ao gerar o código do paciente. */
export type CreateShareError = "sem_selecao" | "falha_servidor" | "colisao_esgotada";
export function createShareMessage(e: CreateShareError): string {
  switch (e) {
    case "sem_selecao": return "Escolha ao menos um tipo de informação para compartilhar.";
    case "colisao_esgotada": return "Não conseguimos sortear um código livre agora. Tente de novo em alguns segundos.";
    default: return "O servidor não respondeu como esperado. Seu histórico está seguro; tente de novo.";
  }
}

/** Resultado da abertura do código do paciente pelo médico em /medico. */
export type OpenShareFailure = "invalido" | "expirado" | "revogado" | "bloqueado" | "rede" | "servidor";
export function openShareMessage(f: OpenShareFailure): string {
  switch (f) {
    case "invalido": return "Código não encontrado. Confira os caracteres com o paciente.";
    case "expirado": return "Este código expirou. Peça ao paciente para gerar um novo.";
    case "revogado": return "O paciente encerrou este acesso.";
    case "bloqueado": return "Muitos códigos inexistentes a partir desta rede. Aguarde 15 minutos e tente de novo.";
    case "rede": return "Sem conexão.";
    default: return "O servidor falhou ao abrir o histórico. Tente de novo em instantes.";
  }
}

/** Falhas em que vale repetir sem mudar nada: mostram o botão "Tentar de novo". */
export const RETRY_LABEL = "Tentar de novo";
export const isRetryable = (f: OpenShareFailure) => f === "rede" || f === "servidor";

/** Separa falha de rede (fetch não chegou) de falha do servidor. */
export function failureFromError(err: unknown, online: boolean): "rede" | "servidor" {
  if (!online) return "rede";
  const msg = err instanceof Error ? err.message : String(err);
  return /failed to fetch|networkerror|load failed|network request failed/i.test(msg) ? "rede" : "servidor";
}

/** Motivos de o código de solicitação (6 números) não poder ser respondido. */
export type RequestLookupReason = "nao_encontrado" | "expirado" | "outro_paciente" | "ja_respondido" | "bloqueado";
export function requestLookupMessage(r: RequestLookupReason): string {
  switch (r) {
    case "nao_encontrado": return "Código não encontrado. Confira os 6 números com o profissional.";
    case "expirado": return "Este código expirou. Peça ao profissional um novo código.";
    case "outro_paciente": return "Este código foi gerado para outro paciente. Confirme com o profissional.";
    case "ja_respondido": return "Esta solicitação já foi respondida.";
    default: return "Muitas tentativas. Aguarde 15 minutos e tente de novo.";
  }
}

/** Limite de tentativas: só tentativas que falharam contam; uma abertura válida nunca conta. */
export const MAX_FAILED_LOOKUPS = 10;
export const LOOKUP_WINDOW_MIN = 15;
export const countsAsAttempt = (found: boolean) => !found;
export const lookupBlocked = (recentFailures: number) => recentFailures >= MAX_FAILED_LOOKUPS;
