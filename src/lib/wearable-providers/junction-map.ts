// Mapeamento puro dos eventos do Junction (docs.junction.com) para leituras do Anamedis. Testado em junction-map.test.ts.
import type { Source } from "@/lib/wearables";

export const JUNCTION_SLUG: Partial<Record<Source, string>> = {
  apple_health: "apple_health_kit", health_connect: "health_connect", garmin: "garmin", fitbit: "fitbit", oura: "oura", whoop: "whoop_v2", polar: "polar",
};
export function sourceFromSlug(slug: string | undefined | null): Source | null {
  if (!slug) return null;
  if (slug.startsWith("whoop")) return "whoop";
  const hit = (Object.entries(JUNCTION_SLUG) as [Source, string][]).find(([, s]) => s === slug);
  return hit ? hit[0] : null;
}

type Out = { metric: string; value: number; unit: string; measured_at: string; external_id?: string };
const SIMPLE: Record<string, { metric: string; unit: string }> = {
  heartrate: { metric: "heart_rate", unit: "bpm" },
  hrv: { metric: "hrv", unit: "ms" },
  blood_oxygen: { metric: "spo2", unit: "%" },
  glucose: { metric: "glucose", unit: "mg/dL" },
  steps: { metric: "steps", unit: "passos" },
  weight: { metric: "weight", unit: "kg" },
  body_temperature: { metric: "temperature", unit: "°C" },
};

export type JunctionMapped = { clientUserId: string | null; externalUserId: string | null; source: Source | null; device: string; readings: Out[]; connectionEvent: "created" | "error" | null };

/** Evento do webhook → leituras. Eventos sem dados (ex.: histórico concluído) dão lista vazia. */
export function mapJunctionEvent(ev: unknown): JunctionMapped {
  const e: any = ev ?? {};
  const type = String(e.event_type ?? "");
  const data: any = e.data ?? {};
  const providerSlug = typeof data.provider === "string" ? data.provider : data.provider?.slug ?? data.source?.provider ?? data.source?.slug;
  const base = {
    clientUserId: (e.client_user_id ?? data.client_user_id ?? null) as string | null,
    externalUserId: (e.user_id ?? data.user_id ?? null) as string | null,
    source: sourceFromSlug(providerSlug),
    device: String(data.source?.name ?? data.source?.device_model ?? providerSlug ?? "Dispositivo"),
  };
  if (type === "provider.connection.created") return { ...base, readings: [], connectionEvent: "created" };
  if (type === "provider.connection.error") return { ...base, readings: [], connectionEvent: "error" };
  const m = /^daily\.data\.([a-z_]+)\.(created|updated)$/.exec(type);
  if (!m) return { ...base, readings: [], connectionEvent: null };
  const resource = m[1]!;
  const items: any[] = Array.isArray(data.data) ? data.data : [];
  const out: Out[] = [];
  const at = (x: any) => String(x.timestamp ?? x.start ?? x.calendar_date ?? x.date ?? "");
  if (resource === "blood_pressure") {
    for (const x of items) {
      if (typeof x.systolic === "number") out.push({ metric: "bp_systolic", value: x.systolic, unit: "mmHg", measured_at: at(x), external_id: x.id });
      if (typeof x.diastolic === "number") out.push({ metric: "bp_diastolic", value: x.diastolic, unit: "mmHg", measured_at: at(x), external_id: x.id });
    }
  } else if (resource === "sleep") {
    const s = items.length ? items : [data];
    for (const x of s) if (typeof x.total === "number") out.push({ metric: "sleep_minutes", value: Math.round(x.total / 60), unit: "min", measured_at: String(x.bedtime_stop ?? x.calendar_date ?? at(x)), external_id: x.id });
  } else if (resource === "activity") {
    const s = items.length ? items : [data];
    for (const x of s) if (typeof x.steps === "number") out.push({ metric: "steps", value: x.steps, unit: "passos", measured_at: String(x.calendar_date ? `${x.calendar_date}T12:00:00Z` : at(x)), external_id: x.id });
  } else if (SIMPLE[resource]) {
    const def = SIMPLE[resource]!;
    for (const x of items) {
      if (typeof x.value !== "number") continue;
      let value = x.value; const unit = String(x.unit ?? "");
      if (def.metric === "glucose" && /mmol/i.test(unit)) value = Math.round(value * 18);
      if (def.metric === "spo2" && value <= 1) value = Math.round(value * 1000) / 10;
      out.push({ metric: def.metric, value, unit: def.unit, measured_at: at(x), external_id: x.id ?? undefined });
    }
  }
  return { ...base, readings: out, connectionEvent: null };
}

// ---- Assinatura Svix (Junction): HMAC-SHA256 de "id.timestamp.corpo" com o segredo whsec_ em base64.
function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> { const bin = atob(b64); const u = new Uint8Array(new ArrayBuffer(bin.length)); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
function bytesToB64(u: Uint8Array): string { let s = ""; for (const b of u) s += String.fromCharCode(b); return btoa(s); }

export async function svixSignature(secret: string, id: string, ts: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", b64ToBytes(secret.replace(/^whsec_/, "")), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${ts}.${body}`));
  return bytesToB64(new Uint8Array(sig));
}

function safeEq(a: string, b: string): boolean { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }

/** Verifica os cabeçalhos svix-id/svix-timestamp/svix-signature (tolerância de 5 min). */
export async function verifySvix(secret: string, h: { id: string | null; timestamp: string | null; signature: string | null }, body: string, now: Date): Promise<boolean> {
  if (!h.id || !h.timestamp || !h.signature) return false;
  const ts = Number(h.timestamp);
  if (!Number.isFinite(ts) || Math.abs(now.getTime() / 1000 - ts) > 300) return false;
  const expected = await svixSignature(secret, h.id, h.timestamp, body);
  return h.signature.split(" ").some((p) => { const [v, s] = p.split(","); return v === "v1" && !!s && safeEq(s, expected); });
}
