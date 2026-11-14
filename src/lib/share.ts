// Regras do compartilhamento com médico — funções puras, testadas em share.test.ts.
export type ShareCategory = "exames" | "laudos" | "consultas" | "receitas" | "vacinas";
export type ShareSignal = "fc" | "sono" | "spo2" | "passos" | "pressao" | "glicose";
export type ShareRequest = {
  categories: ShareCategory[];
  signals: ShareSignal[];
  includeProfile: boolean;
  periodMonths: number;
  validityHours: number;
};

export const VALIDITY_OPTIONS = [1, 24, 72, 168] as const;
export const PERIOD_OPTIONS = [3, 6, 12, 60] as const;

/** Retorna os problemas que impedem gerar o código; lista vazia = pode gerar. */
export function validateShare(r: ShareRequest): string[] {
  const errors: string[] = [];
  if (r.categories.length === 0 && r.signals.length === 0 && !r.includeProfile) errors.push("Escolha ao menos um tipo de informação.");
  if (!(VALIDITY_OPTIONS as readonly number[]).includes(r.validityHours)) errors.push("Validade inválida.");
  if (!(PERIOD_OPTIONS as readonly number[]).includes(r.periodMonths)) errors.push("Período inválido.");
  return errors;
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0/O e 1/I para leitura em voz alta

/** Código de 8 caracteres no formato XXXX-XXXX. */
export function formatShareCode(random: () => number = Math.random): string {
  let s = "";
  for (let i = 0; i < 8; i++) s += ALPHABET[Math.floor(random() * ALPHABET.length)];
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

export function normalizeCode(input: string): string {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return raw.length === 8 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : raw;
}

export type AccessState = "valido" | "expirado" | "revogado";
export function accessState(expiresAt: Date, revoked: boolean, now: Date = new Date()): AccessState {
  if (revoked) return "revogado";
  return now.getTime() >= expiresAt.getTime() ? "expirado" : "valido";
}

/** O questionário só é consultado quando este consentimento explícito existe. */
export function profileVisible(share: { include_profile: boolean }): boolean {
  return share.include_profile;
}

const KIND_TO_CATEGORY: Record<string, ShareCategory> = {
  Exame: "exames", Laudo: "laudos", Consulta: "consultas", Receita: "receitas", Vacina: "vacinas",
};

/** O médico só vê documentos da categoria autorizada e adicionados dentro do período. */
export function docVisible(
  doc: { kind: string; created_at: string },
  share: { categories: string[]; period_months: number },
  now: Date = new Date(),
): boolean {
  const cat = KIND_TO_CATEGORY[doc.kind];
  if (!cat || !share.categories.includes(cat)) return false;
  const limit = new Date(now);
  limit.setMonth(limit.getMonth() - share.period_months);
  return new Date(doc.created_at).getTime() >= limit.getTime();
}
