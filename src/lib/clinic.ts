// Regras das solicitações de acesso feitas pelo médico — funções puras, testadas em clinic.test.ts.
export const REQUEST_MINUTES = 15;
export const AUTHORIZED_HOURS = 2;
export const MAX_LOOKUPS = 10; // tentativas de código por paciente a cada 15 minutos

/** Código numérico de 6 dígitos, gerado com aleatoriedade criptográfica e sem viés. */
export function generateRequestCode(): string {
  const buf = new Uint32Array(1);
  const limit = 4_294_000_000; // múltiplo de 1.000.000 abaixo de 2^32
  do crypto.getRandomValues(buf); while ((buf[0] ?? 0) >= limit);
  return String((buf[0] ?? 0) % 1_000_000).padStart(6, "0");
}

export function normalizeRequestCode(input: string): string {
  return input.replace(/\D/g, "").slice(0, 6);
}

export function isRequestCode(code: string): boolean {
  return /^[0-9]{6}$/.test(code);
}

export function formatRequestCode(code: string): string {
  return code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
}

/** Uma solicitação só pode ser respondida enquanto pendente e dentro da validade. */
export function requestOpen(r: { status: string; expires_at: string }, now: Date = new Date()): boolean {
  return r.status === "pending" && new Date(r.expires_at).getTime() > now.getTime();
}

/** Identificador exibido ao médico: não revela dados de saúde. */
export function patientRef(patientId: string): string {
  return `VT-${patientId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"] as const;
