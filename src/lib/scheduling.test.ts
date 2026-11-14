import { describe, expect, it } from "vitest";
import { canChange, haversineKm, matchesCoverage, reserve, searchProviders, sortResults, withinRadius, type Provider, type ProviderResult, type Slot } from "./scheduling";

const paulista = { lat: -23.5651, lng: -46.6519 };
const now = new Date("2026-11-16T12:00:00Z");
const P = (id: string, o: Partial<Provider> = {}): Provider => ({ id, kind: "medico", name: id, specialties: ["Cardiologia"], address: "", city: "São Paulo", uf: "SP", lat: paulista.lat, lng: paulista.lng, telehealth: false, in_person: true, price_private: 300, is_demo: true, planIds: [], ...o });
const S = (id: string, iso: string, booked = false): Slot => ({ id, starts_at: iso, duration_min: 30, booked });

describe("haversine e raio", () => {
  it("São Paulo → Belo Horizonte ≈ 490 km", () => {
    expect(haversineKm(paulista, { lat: -19.9245, lng: -43.9352 })).toBeGreaterThan(480);
    expect(haversineKm(paulista, { lat: -19.9245, lng: -43.9352 })).toBeLessThan(500);
  });
  it("mesmo ponto = 0", () => expect(haversineKm(paulista, paulista)).toBe(0));
  it("raio de 2 km exclui quem está a ~3,5 km", () => {
    const pin = { lat: -23.566, lng: -46.687 }; // Pinheiros
    const d = haversineKm(paulista, pin);
    expect(withinRadius(d, 2)).toBe(false);
    expect(withinRadius(d, 5)).toBe(true);
    expect(withinRadius(d, null)).toBe(true);
  });
  it("busca com raio filtra pela distância", () => {
    const r = searchProviders([P("perto"), P("longe", { lat: -19.92, lng: -43.93 })], new Map(), { mode: "ambos", origin: paulista, radiusKm: 50, coverage: "todos", sort: "distancia" }, now);
    expect(r.map((x) => x.id)).toEqual(["perto"]);
  });
});

describe("convênio", () => {
  const p = { planIds: ["A"] };
  it("aceitam meu plano", () => { expect(matchesCoverage(p, "meu_plano", "A")).toBe(true); expect(matchesCoverage(p, "meu_plano", "B")).toBe(false); });
  it("sem plano, 'aceitam meu plano' não mostra ninguém", () => expect(matchesCoverage(p, "meu_plano", null)).toBe(false));
  it("particular exclui quem aceita meu plano", () => { expect(matchesCoverage(p, "particular", "A")).toBe(false); expect(matchesCoverage(p, "particular", "B")).toBe(true); });
  it("todos mostra todos", () => expect(matchesCoverage(p, "todos", "B")).toBe(true));
});

describe("ordenação", () => {
  const r = (id: string, distanceKm: number | null, price: number | null, first?: string): ProviderResult => ({ ...P(id, { price_private: price }), distanceKm, acceptsMyPlan: false, nextSlots: first ? [S("s" + id, first)] : [] });
  const list = [r("a", 5, 400, "2026-11-20T12:00:00Z"), r("b", 1, 200, "2026-11-25T12:00:00Z"), r("c", 3, 300, "2026-11-18T12:00:00Z")];
  it("distância", () => expect(sortResults(list, "distancia").map((x) => x.id)).toEqual(["b", "c", "a"]));
  it("preço", () => expect(sortResults(list, "preco").map((x) => x.id)).toEqual(["b", "c", "a"]));
  it("próxima vaga", () => expect(sortResults(list, "vaga").map((x) => x.id)).toEqual(["c", "a", "b"]));
});

describe("reserva sem dupla marcação", () => {
  const slots = [S("1", "2026-11-20T12:00:00Z")];
  it("segunda reserva do mesmo horário é recusada", () => {
    const first = reserve(slots, "1", now);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(reserve(first.slots, "1", now)).toEqual({ ok: false, reason: "ocupado" });
  });
  it("horário passado é recusado", () => expect(reserve([S("2", "2026-11-16T11:00:00Z")], "2", now)).toEqual({ ok: false, reason: "passado" }));
});

describe("remarcar/cancelar até 2 horas antes", () => {
  it("exatamente 2 h antes ainda pode", () => expect(canChange("2026-11-16T14:00:00Z", now)).toBe(true));
  it("1h59 antes não pode", () => expect(canChange("2026-11-16T13:59:00Z", now)).toBe(false));
});
