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

// ---------- Área do profissional ----------
export type RequestStatus = "pending" | "authorized" | "declined" | "expired";
export type RequestEvent = "authorize" | "decline" | "expire";

/** Transições permitidas: só "pending" muda; os demais estados são finais. */
export function nextRequestStatus(from: string, event: RequestEvent): RequestStatus | null {
  if (from !== "pending") return null;
  return event === "authorize" ? "authorized" : event === "decline" ? "declined" : "expired";
}

/** Estado exibido de uma solicitação (pendente vencida conta como expirada). */
export function displayRequestStatus(r: { status: string; expires_at: string }, now: Date = new Date()): RequestStatus {
  if (r.status === "pending") return requestOpen(r, now) ? "pending" : "expired";
  return (["authorized", "declined", "expired"].includes(r.status) ? r.status : "expired") as RequestStatus;
}

export type ProAccess = {
  status: string;
  upload_granted: boolean;
  share: { expires_at: string; revoked: boolean } | null;
};

/** Acesso do profissional está ativo: solicitação autorizada e código não revogado nem vencido. */
export function accessActive(a: ProAccess, now: Date = new Date()): boolean {
  return a.status === "authorized" && !!a.share && !a.share.revoked && new Date(a.share.expires_at).getTime() > now.getTime();
}

/** Envio de documento: exige a permissão própria e vence junto com o acesso. */
export function canUpload(a: ProAccess, now: Date = new Date()): boolean {
  return a.upload_granted && accessActive(a, now);
}

/** Como um acesso encerrado aparece no histórico do profissional. */
export function endedState(a: ProAccess, now: Date = new Date()): "ativo" | "expirado" | "revogado" | "recusado" {
  if (a.status === "declined") return "recusado";
  if (accessActive(a, now)) return "ativo";
  if (a.share?.revoked) return "revogado";
  return "expirado";
}

export type DocStatus = "accepted" | "pending_patient" | "rejected";
/** Só documentos aceitos entram em códigos, visões de família ou de outros profissionais. */
export function docVisibleToOthers(doc: { status?: string | null }): boolean {
  return (doc.status ?? "accepted") === "accepted";
}

/** Perto de vencer: menos de 30 minutos restantes. */
export function accessNearExpiry(expiresAt: string, now: Date = new Date()): boolean {
  const ms = new Date(expiresAt).getTime() - now.getTime();
  return ms > 0 && ms <= 30 * 60_000;
}

export const PRO_DOC_TYPES = [
  { id: "laudo", label: "Laudo", kind: "Laudo" },
  { id: "exame_lab", label: "Exame laboratorial", kind: "Exame" },
  { id: "exame_imagem", label: "Exame de imagem", kind: "Exame" },
  { id: "receita", label: "Receita", kind: "Receita" },
  { id: "consulta", label: "Relatório de consulta", kind: "Consulta" },
  { id: "outro", label: "Outro", kind: "Outro" },
] as const;
export type ProDocType = (typeof PRO_DOC_TYPES)[number]["id"];

export function normalizePatientRef(input: string): string {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^VT/, "").slice(0, 8);
  return `VT-${raw}`;
}
export function isPatientRef(ref: string): boolean {
  return /^VT-[0-9A-F]{8}$/.test(ref);
}
