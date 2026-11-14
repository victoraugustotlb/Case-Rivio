// Regras do agendamento — funções puras, testadas em scheduling.test.ts.
export type Mode = "presencial" | "telemedicina";
export type ModeFilter = Mode | "ambos";
export type CoverageFilter = "meu_plano" | "particular" | "todos";
export type SortBy = "distancia" | "vaga" | "preco";

export type Slot = { id: string; starts_at: string; duration_min: number; booked: boolean };
export type Provider = {
  id: string; kind: "medico" | "clinica" | "laboratorio"; name: string; specialties: string[];
  address: string; city: string; uf: string; lat: number; lng: number;
  telehealth: boolean; in_person: boolean; price_private: number | null; is_demo: boolean;
  planIds: string[];
};
export type ProviderResult = Provider & { distanceKm: number | null; acceptsMyPlan: boolean; nextSlots: Slot[] };

export type SearchQuery = {
  specialty?: string | undefined;
  mode: ModeFilter;
  origin?: { lat: number; lng: number } | null | undefined;
  city?: string | null | undefined;
  radiusKm: number | null; // null = qualquer distância
  coverage: CoverageFilter;
  myPlanId?: string | null | undefined;
  date?: string | null | undefined; // AAAA-MM-DD (dia desejado, horário de Brasília)
  sort: SortBy;
};

export const RADIUS_MIN = 2;
export const RADIUS_MAX = 50;
export const CHANGE_LIMIT_HOURS = 2;

/** Distância em km entre dois pontos (fórmula de haversine). */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Arredonda a posição (~1 km) antes de sair do aparelho: a localização exata nunca é enviada nem guardada. */
export function coarse(p: { lat: number; lng: number }) {
  return { lat: Math.round(p.lat * 100) / 100, lng: Math.round(p.lng * 100) / 100 };
}

export const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** Dia (AAAA-MM-DD) em horário de Brasília. */
export function dayKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

export function withinRadius(distanceKm: number | null, radiusKm: number | null): boolean {
  if (radiusKm === null) return true;
  return distanceKm !== null && distanceKm <= radiusKm;
}

export function matchesCoverage(p: { planIds: string[] }, coverage: CoverageFilter, myPlanId?: string | null): boolean {
  if (coverage === "todos") return true;
  if (coverage === "meu_plano") return !!myPlanId && p.planIds.includes(myPlanId);
  return !myPlanId || !p.planIds.includes(myPlanId); // particular: sem convênio com o meu plano
}

export function matchesMode(p: { telehealth: boolean; in_person: boolean }, mode: ModeFilter): boolean {
  if (mode === "telemedicina") return p.telehealth;
  if (mode === "presencial") return p.in_person;
  return true;
}

export function openSlots(slots: Slot[], now: Date, date?: string | null): Slot[] {
  return slots
    .filter((s) => !s.booked && new Date(s.starts_at).getTime() > now.getTime() && (!date || dayKey(s.starts_at) >= date))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

export function searchProviders(providers: Provider[], slotsBy: Map<string, Slot[]>, q: SearchQuery, now: Date = new Date()): ProviderResult[] {
  const spec = q.specialty ? norm(q.specialty) : "";
  const out: ProviderResult[] = [];
  for (const p of providers) {
    if (spec && !p.specialties.some((s) => norm(s) === spec)) continue;
    if (!matchesMode(p, q.mode)) continue;
    if (!matchesCoverage(p, q.coverage, q.myPlanId)) continue;
    // Telemedicina pura não depende de distância.
    const remoteOnly = q.mode === "telemedicina";
    if (!q.origin && q.city && !remoteOnly && norm(p.city) !== norm(q.city)) continue;
    const distanceKm = q.origin ? haversineKm(q.origin, p) : null;
    if (q.origin && !remoteOnly && !withinRadius(distanceKm, q.radiusKm)) continue;
    const slots = openSlots(slotsBy.get(p.id) ?? [], now, q.date);
    if (q.date && slots.length === 0) continue;
    out.push({ ...p, distanceKm, acceptsMyPlan: !!q.myPlanId && p.planIds.includes(q.myPlanId), nextSlots: slots.slice(0, 3) });
  }
  return sortResults(out, q.sort);
}

export function sortResults(list: ProviderResult[], sort: SortBy): ProviderResult[] {
  const big = Number.POSITIVE_INFINITY;
  const key = (r: ProviderResult) =>
    sort === "distancia" ? r.distanceKm ?? big
    : sort === "preco" ? r.price_private ?? big
    : r.nextSlots[0] ? new Date(r.nextSlots[0].starts_at).getTime() : big;
  return [...list].sort((a, b) => key(a) - key(b) || a.name.localeCompare(b.name));
}

/** Reserva em memória com a mesma regra da função do banco: um horário livre só pode ser reservado uma vez. */
export function reserve(slots: Slot[], slotId: string, now: Date = new Date()): { ok: true; slots: Slot[] } | { ok: false; reason: "inexistente" | "ocupado" | "passado" } {
  const s = slots.find((x) => x.id === slotId);
  if (!s) return { ok: false, reason: "inexistente" };
  if (s.booked) return { ok: false, reason: "ocupado" };
  if (new Date(s.starts_at).getTime() <= now.getTime()) return { ok: false, reason: "passado" };
  return { ok: true, slots: slots.map((x) => (x.id === slotId ? { ...x, booked: true } : x)) };
}

/** Cancelar ou remarcar só até 2 horas antes do início. */
export function canChange(startsAt: string, now: Date = new Date()): boolean {
  return new Date(startsAt).getTime() - now.getTime() >= CHANGE_LIMIT_HOURS * 3600_000;
}

/** Lembrete na véspera: a consulta é amanhã (horário de Brasília). */
export function isTomorrow(startsAt: string, now: Date = new Date()): boolean {
  return dayKey(startsAt) === dayKey(new Date(now.getTime() + 86400_000).toISOString());
}

export const DB_ERRORS: Record<string, string> = {
  horario_ocupado: "Este horário acabou de ser reservado. Escolha outro.",
  horario_passado: "Este horário já passou.",
  horario_inexistente: "Horário não encontrado.",
  prazo_encerrado: "Só é possível cancelar ou remarcar até 2 horas antes.",
  modo_indisponivel: "Este tipo de atendimento não está disponível.",
  agendamento_invalido: "Agendamento não encontrado ou já alterado.",
  codigo_invalido: "Código de compartilhamento inválido.",
};
export function friendlyError(msg: string): string {
  const k = Object.keys(DB_ERRORS).find((x) => msg.includes(x));
  return k ? DB_ERRORS[k]! : "Não foi possível concluir. Tente novamente.";
}
