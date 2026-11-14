// Regras da família do plano — funções puras, testadas em family.test.ts.
// Nenhuma tela decide acesso sozinha: as funções de servidor usam canViewMember.
import { ageFromBirthDate } from "./profile";

export type FamilyMembership = { user_id: string; plan_id: string; card_number: string; role: "titular" | "dependente"; holder_card_number: string | null; status: string; created_at?: string };
export type FamilyMember = { id: string; role: "titular" | "dependente"; planId: string; familyKey: string | null; birthDate: string | null };
export type FamilyGrant = { owner_id: string; viewer_id: string; scope: "tudo" | "categorias"; categories: string[]; expires_at: string | null; status: string; revoked_at: string | null; basis: "consentimento" | "responsavel_legal" };
export type ViewDecision =
  | { allowed: true; basis: "proprio" | "responsavel_legal" | "consentimento"; scope: "tudo" | "categorias"; categories: string[]; canWrite: boolean }
  | { allowed: false; reason: "outra_familia" | "sem_consentimento" | "expirado" | "revogado" | "pendente" };

/** Chave da família: a carteirinha do titular. Só vínculos ativos fazem parte. */
export function familyKey(m: Pick<FamilyMembership, "role" | "card_number" | "holder_card_number" | "status">): string | null {
  if (m.status !== "active") return null;
  return m.role === "titular" ? m.card_number : m.holder_card_number;
}

/** Separa titular e dependentes ativos de uma família (mesmo plano + mesma carteirinha do titular). */
export function resolveFamily(rows: FamilyMembership[], planId: string, key: string) {
  const ativos = rows.filter((r) => r.plan_id === planId && r.status === "active" && familyKey(r) === key);
  return {
    holder: ativos.find((r) => r.role === "titular" && r.card_number === key) ?? null,
    dependents: ativos.filter((r) => r.role === "dependente"),
  };
}

/** Acha o titular ativo a quem um pedido se refere. Carteirinha sozinha não dá acesso: só aponta o titular que vai decidir. */
export function findHolder(rows: FamilyMembership[], planId: string, holderCard: string): FamilyMembership | null {
  return rows.find((r) => r.plan_id === planId && r.role === "titular" && r.status === "active" && r.card_number === holderCard) ?? null;
}

export function isMinor(birthDate: string | null | undefined, now: Date = new Date()): boolean {
  const age = ageFromBirthDate(birthDate ?? null, now);
  return age !== null && age < 18;
}

export function canViewMember(viewer: FamilyMember, owner: FamilyMember, grant: FamilyGrant | null, now: Date = new Date()): ViewDecision {
  if (viewer.id === owner.id) return { allowed: true, basis: "proprio", scope: "tudo", categories: [], canWrite: true };
  if (!viewer.familyKey || viewer.familyKey !== owner.familyKey || viewer.planId !== owner.planId) return { allowed: false, reason: "outra_familia" };
  // Responsável legal: titular vê o dependente menor de idade; termina sozinho aos 18.
  if (viewer.role === "titular" && owner.role === "dependente" && isMinor(owner.birthDate, now)) {
    return { allowed: true, basis: "responsavel_legal", scope: "tudo", categories: [], canWrite: true };
  }
  const g = grant && grant.owner_id === owner.id && grant.viewer_id === viewer.id && grant.basis === "consentimento" ? grant : null;
  if (!g) return { allowed: false, reason: "sem_consentimento" };
  if (g.status === "revogado" || g.revoked_at) return { allowed: false, reason: "revogado" };
  if (g.status === "pendente") return { allowed: false, reason: "pendente" };
  if (g.status !== "ativo") return { allowed: false, reason: "sem_consentimento" };
  if (g.expires_at && new Date(g.expires_at).getTime() <= now.getTime()) return { allowed: false, reason: "expirado" };
  return { allowed: true, basis: "consentimento", scope: g.scope, categories: g.scope === "tudo" ? [] : g.categories, canWrite: false };
}

/** Um documento entra no que o familiar pode ver? */
export function kindAllowed(d: Extract<ViewDecision, { allowed: true }>, kind: string): boolean {
  return d.scope === "tudo" || d.categories.includes(kind);
}

export type RequestDecision = { ok: true; status: "aprovado" | "recusado" } | { ok: false; error: string };
/** Só o titular indicado decide, e só pedidos ainda pendentes. */
export function decideFamilyRequest(req: { holder_id: string | null; status: string; requester_id: string }, callerId: string, approve: boolean): RequestDecision {
  if (!req.holder_id || req.holder_id !== callerId) return { ok: false, error: "Só o titular do plano pode responder a este pedido." };
  if (req.requester_id === callerId) return { ok: false, error: "Você não pode aprovar o próprio pedido." };
  if (req.status !== "pendente") return { ok: false, error: "Este pedido já foi respondido." };
  return { ok: true, status: approve ? "aprovado" : "recusado" };
}

export const GRANT_DURATIONS = { "30d": "30 dias", "6m": "6 meses", sem_prazo: "Sem prazo" } as const;
export type GrantDuration = keyof typeof GRANT_DURATIONS;
export function grantExpiry(d: GrantDuration, now: Date = new Date()): string | null {
  if (d === "sem_prazo") return null;
  const e = new Date(now);
  if (d === "30d") e.setDate(e.getDate() + 30); else e.setMonth(e.getMonth() + 6);
  return e.toISOString();
}

/** Código para médico a partir de outro perfil: só o responsável legal de um menor. */
export function canShareFor(d: ViewDecision): boolean {
  return d.allowed && (d.basis === "proprio" || d.basis === "responsavel_legal");
}
