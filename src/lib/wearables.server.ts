// Caminho único de gravação de leituras (API de entrada, webhook do agregador e Bluetooth). Só servidor.
import type { SupabaseClient } from "@supabase/supabase-js";
import { validateReading, type RejectReason, type ReadingInput } from "@/lib/wearables";

export async function sha256Hex(s: string): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
  return [...h].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function ingestReadings(
  admin: SupabaseClient,
  args: { userId: string; connectionId: string | null; device: string; readings: (ReadingInput & { external_id?: string | undefined })[] },
): Promise<{ accepted: number; duplicates: number; rejected: { index: number; reason: RejectReason }[] }> {
  const now = new Date();
  const rejected: { index: number; reason: RejectReason }[] = [];
  const rows: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  let dupInBatch = 0;
  args.readings.forEach((r, index) => {
    const v = validateReading(r, now);
    if (!v.ok) { rejected.push({ index, reason: v.reason }); return; }
    const measured = new Date(r.measured_at).toISOString();
    const key = `${r.metric}|${measured}`;
    if (seen.has(key)) { dupInBatch++; return; }
    seen.add(key);
    rows.push({ user_id: args.userId, connection_id: args.connectionId, metric: r.metric, value: r.value, unit: r.unit, measured_at: measured, source_device: args.device.slice(0, 120), external_id: r.external_id ?? null });
  });
  let inserted = 0;
  if (rows.length) {
    const { data, error } = await admin.from("wearable_readings").upsert(rows, { onConflict: "user_id,metric,measured_at,source_device", ignoreDuplicates: true }).select("id");
    if (error) throw new Error("Falha ao gravar leituras.");
    inserted = data?.length ?? 0;
    if (args.connectionId) await admin.from("wearable_connections").update({ last_sync_at: now.toISOString(), status: "connected", last_error: null }).eq("id", args.connectionId).neq("status", "revoked");
  }
  return { accepted: inserted, duplicates: rows.length - inserted + dupInBatch, rejected };
}

/** Conexão do tipo pedido para o usuário, criada se não existir. Uma conexão desconectada pelo dono só volta com reactivate (novo consentimento). */
export async function ensureConnection(admin: SupabaseClient, userId: string, provider: string, source: string, displayName: string, opts: { reactivate?: boolean; externalUserId?: string } = {}): Promise<{ id: string; status: string }> {
  const { data: found } = await admin.from("wearable_connections").select("id,status").eq("user_id", userId).eq("provider", provider).eq("source", source).eq("display_name", displayName).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (found && (found.status !== "revoked" || !opts.reactivate)) return found;
  const { data, error } = await admin.from("wearable_connections").insert({ user_id: userId, provider, source, display_name: displayName, status: provider === "junction" ? "pending" : "connected", external_user_id: opts.externalUserId ?? null }).select("id,status").single();
  if (error || !data) throw new Error("Falha ao criar conexão.");
  return data;
}
