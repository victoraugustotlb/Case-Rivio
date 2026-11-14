// Interface da rede de atendimento. Hoje: diretório de demonstração no banco.
// Para usar a rede credenciada real de uma operadora, implemente ProviderDirectory e troque em directoryFor().
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { searchProviders, type Provider, type ProviderResult, type SearchQuery, type Slot } from "./scheduling";

export interface ProviderDirectory {
  search(q: SearchQuery, now?: Date): Promise<ProviderResult[]>;
  get(id: string): Promise<{ provider: Provider; slots: Slot[]; planNames: string[] } | null>;
  specialties(): Promise<string[]>;
  cities(): Promise<{ city: string; uf: string; lat: number; lng: number }[]>;
}

type Sb = SupabaseClient<Database>;
const COLS = "id,kind,name,specialties,address,city,uf,lat,lng,telehealth,in_person,price_private,is_demo,provider_plans(plan_id)";

function toProvider(r: Record<string, unknown>): Provider {
  const { provider_plans, ...rest } = r as Record<string, unknown> & { provider_plans: { plan_id: string }[] };
  return { ...(rest as unknown as Omit<Provider, "planIds">), price_private: rest["price_private"] == null ? null : Number(rest["price_private"]), planIds: (provider_plans ?? []).map((x) => x.plan_id) };
}

export class DbDirectory implements ProviderDirectory {
  constructor(private sb: Sb) {}
  async search(q: SearchQuery, now = new Date()) {
    const { data: rows, error } = await this.sb.from("providers").select(COLS);
    if (error) throw new Error(error.message);
    const providers = (rows ?? []).map((r) => toProvider(r as Record<string, unknown>));
    const until = new Date(now.getTime() + 45 * 86400_000).toISOString();
    const { data: slots } = await this.sb.from("availability_slots").select("id,provider_id,starts_at,duration_min,booked")
      .eq("booked", false).gt("starts_at", now.toISOString()).lt("starts_at", until).order("starts_at").limit(5000);
    const by = new Map<string, Slot[]>();
    for (const s of slots ?? []) { const l = by.get(s.provider_id) ?? []; l.push(s); by.set(s.provider_id, l); }
    return searchProviders(providers, by, q, now);
  }
  async get(id: string) {
    const { data: r } = await this.sb.from("providers").select(COLS).eq("id", id).maybeSingle();
    if (!r) return null;
    const provider = toProvider(r as Record<string, unknown>);
    const { data: slots } = await this.sb.from("availability_slots").select("id,starts_at,duration_min,booked").eq("provider_id", id)
      .gt("starts_at", new Date().toISOString()).order("starts_at").limit(400);
    const { data: plans } = provider.planIds.length ? await this.sb.from("insurance_plans").select("name").in("id", provider.planIds) : { data: [] };
    return { provider, slots: slots ?? [], planNames: (plans ?? []).map((p) => p.name) };
  }
  async specialties() {
    const { data } = await this.sb.from("providers").select("specialties");
    return [...new Set((data ?? []).flatMap((r) => r.specialties))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }
  async cities() {
    const { data } = await this.sb.from("providers").select("city,uf,lat,lng");
    const m = new Map<string, { city: string; uf: string; lat: number; lng: number; n: number }>();
    for (const r of data ?? []) {
      const k = `${r.city}/${r.uf}`; const c = m.get(k) ?? { city: r.city, uf: r.uf, lat: 0, lng: 0, n: 0 };
      c.lat += r.lat; c.lng += r.lng; c.n++; m.set(k, c);
    }
    return [...m.values()].map(({ n, ...c }) => ({ ...c, lat: c.lat / n, lng: c.lng / n }));
  }
}

export function directoryFor(sb: Sb): ProviderDirectory {
  return new DbDirectory(sb);
}
