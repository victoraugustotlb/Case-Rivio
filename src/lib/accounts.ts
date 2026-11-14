// Regras de tipo de conta, carteirinha e assinatura — funções puras, testadas em accounts.test.ts.
export const ACCOUNT_TYPES = ["patient_plan", "patient_individual", "doctor", "laboratory"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export function homeFor(type: AccountType | null | undefined): "/inicio" | "/clinico" {
  return type === "doctor" || type === "laboratory" ? "/clinico" : "/inicio";
}
export const isPatient = (t: AccountType | null | undefined) => t === "patient_plan" || t === "patient_individual";

/** Carteirinha: só dígitos (espaços, pontos e hífens são ignorados), de 8 a 20. */
export function normalizeCard(input: string): string {
  return input.replace(/[\s.\-/]/g, "");
}
export function isCardNumber(input: string): boolean {
  return /^\d{8,20}$/.test(normalizeCard(input));
}

export type MemberRole = "titular" | "dependente";
/** Titular entra ativo; dependente informa a carteirinha do titular e fica pendente até ele aprovar. */
export function membershipRules(role: MemberRole, card: string, holderCard: string | null): { errors: string[]; status: "active" | "pending"; holder: string | null } {
  const errors: string[] = [];
  const c = normalizeCard(card);
  if (!isCardNumber(c)) errors.push("Número da carteirinha inválido: use de 8 a 20 dígitos.");
  if (role === "titular") return { errors, status: "active", holder: null };
  const h = normalizeCard(holderCard ?? "");
  if (!isCardNumber(h)) errors.push("Informe a carteirinha do titular (8 a 20 dígitos).");
  else if (h === c) errors.push("A carteirinha do titular deve ser diferente da sua.");
  return { errors, status: "pending", holder: h };
}

export const PLAN_MAX_ATTEMPTS = 5; // por usuário a cada 15 minutos

export type SubscriptionRow = { status: string; current_period_end: string | null; cancel_at_period_end: boolean } | null;
export type SubscriptionState = "ativa" | "cancelando" | "vencida" | "sem_assinatura";
export function subscriptionState(sub: SubscriptionRow, now: Date = new Date()): SubscriptionState {
  if (!sub) return "sem_assinatura";
  const inPeriod = !sub.current_period_end || new Date(sub.current_period_end).getTime() > now.getTime();
  if (["active", "trialing", "past_due"].includes(sub.status) && inPeriod) return sub.cancel_at_period_end ? "cancelando" : "ativa";
  if (sub.status === "incomplete") return "sem_assinatura";
  return "vencida";
}

/** Igual à função can_write_records do banco: só ENVIAR documentos novos. Gerar códigos, compartilhar, ler e exportar nunca é bloqueado. */
export function canWriteRecords(a: { type: AccountType; exempt: boolean; membershipStatus: string | null; sub: SubscriptionRow }, now: Date = new Date()): boolean {
  if (a.type === "patient_plan") return a.membershipStatus === "active";
  if (a.type === "patient_individual") { const s = subscriptionState(a.sub, now); return a.exempt || s === "ativa" || s === "cancelando"; }
  return false;
}

/** Compartilhar o que já existe (gerar código, autorizar pedido do médico) não depende de cobrança. */
export function canShareRecords(type: AccountType | null | undefined): boolean {
  return isPatient(type ?? "patient_individual");
}
