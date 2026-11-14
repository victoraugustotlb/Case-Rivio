// Regras de destino e de papel — funções puras, testadas em routing.test.ts. Mapa completo em AGENTS.md.
import type { AccountType } from "./accounts";

export type Destination = "/inicio" | "/plano" | "/clinico";
export type Role = "paciente" | "profissional";

/** Único destino depois do login. */
export function destinationFor(a: { accountType: AccountType | null; temVinculoPlano: boolean }): Destination {
  if (a.accountType === "doctor" || a.accountType === "laboratory") return "/clinico";
  if (a.accountType === "patient_plan" && !a.temVinculoPlano) return "/plano";
  return "/inicio";
}

export function roleOf(t: AccountType | null): Role {
  return t === "doctor" || t === "laboratory" ? "profissional" : "paciente";
}

/** Para onde mandar quem abriu uma área que não é do seu papel; null = pode ver. */
export function roleRedirect(required: Role, t: AccountType | null): Destination | null {
  if (roleOf(t) === required) return null;
  return required === "paciente" ? "/clinico" : "/inicio";
}

/** A intenção guardada no login com Google só vale no primeiro login (conta recém-criada). */
export const FIRST_LOGIN_WINDOW_MS = 10 * 60_000;
export function applyEntryIntent(a: { provider: string | null; createdAt: string | null }, now: Date = new Date()): boolean {
  if (a.provider !== "google" || !a.createdAt) return false;
  return now.getTime() - new Date(a.createdAt).getTime() <= FIRST_LOGIN_WINDOW_MS;
}
