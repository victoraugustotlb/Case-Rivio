import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { readingsCsv, SOURCES, type Source } from "@/lib/wearables";

const AGG_SOURCES = ["apple_health", "health_connect", "garmin", "fitbit", "oura", "whoop", "polar"] as const;

/** O agregador só aparece como disponível quando os segredos existem. */
export const wearableProviderStatus = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async () => {
  const { junctionProvider } = await import("@/lib/wearable-providers/junction");
  return { junction: junctionProvider.enabled() };
});

/** Inicia a conexão pelo agregador. Exige o consentimento explícito da tela anterior. */
export const startAggregatorConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ source: z.enum(AGG_SOURCES), consent: z.literal(true) }).parse(d))
  .handler(async ({ data, context }) => {
    const { junctionProvider } = await import("@/lib/wearable-providers/junction");
    if (!junctionProvider.enabled()) return { ok: false as const, error: "em_breve" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { ensureConnection } = await import("@/lib/wearables.server");
    try {
      const lig = await junctionProvider.criarLigacao(context.userId, data.source as Source);
      const conn = await ensureConnection(supabaseAdmin, context.userId, "junction", data.source, SOURCES[data.source], { reactivate: true, externalUserId: lig.externalUserId });
      if (conn.status === "revoked") await supabaseAdmin.from("wearable_connections").update({ status: "pending" }).eq("id", conn.id);
      return { ok: true as const, ligacao: lig.kind === "link" ? { kind: "link" as const, url: lig.url } : { kind: "codigo" as const, code: lig.code, expiresAt: lig.expiresAt } };
    } catch (e) {
      console.warn("startAggregatorConnection falhou", (e as Error).message);
      return { ok: false as const, error: "falha_provedor" };
    }
  });

export const revokeConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("wearable_connections").update({ status: "revoked" }).eq("id", data.id);
    if (error) throw new Error("Não foi possível desconectar.");
    return { ok: true };
  });

export const deleteConnectionData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("wearable_readings").delete().eq("connection_id", data.id);
    if (error) throw new Error("Não foi possível apagar.");
    return { ok: true };
  });

export const deleteAllWearableData = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { error } = await context.supabase.from("wearable_readings").delete().eq("user_id", context.userId);
  if (error) throw new Error("Não foi possível apagar.");
  return { ok: true };
});

export const exportWearableCsv = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const all: { metric: string; value: number; unit: string; measured_at: string; source_device: string }[] = [];
  for (let from = 0; from < 100_000; from += 1000) {
    const { data, error } = await context.supabase.from("wearable_readings").select("metric,value,unit,measured_at,source_device").order("measured_at", { ascending: false }).range(from, from + 999);
    if (error) throw new Error("Não foi possível exportar.");
    all.push(...(data ?? []).map((r) => ({ ...r, value: Number(r.value) })));
    if (!data || data.length < 1000) break;
  }
  return { csv: readingsCsv(all) };
});

export const createIngestToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ label: z.string().trim().min(1).max(60) }).parse(d))
  .handler(async ({ data, context }) => {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const token = "amd_" + btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const { sha256Hex } = await import("@/lib/wearables.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("wearable_ingest_tokens").insert({ user_id: context.userId, label: data.label, token_hash: await sha256Hex(token) });
    if (error) throw new Error("Não foi possível gerar o token.");
    return { token }; // mostrado uma única vez; só o hash fica guardado
  });

export const revokeIngestToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("wearable_ingest_tokens").update({ revoked_at: new Date().toISOString() }).eq("id", data.id).eq("user_id", context.userId);
    if (error) throw new Error("Não foi possível revogar.");
    return { ok: true };
  });

/** Leitura de cinta cardíaca por Bluetooth, gravada pelo mesmo caminho de validação. */
export const recordBleReading = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ bpm: z.number(), measured_at: z.string().datetime({ offset: true }), device: z.string().trim().min(1).max(80) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { ingestReadings, ensureConnection } = await import("@/lib/wearables.server");
    const conn = await ensureConnection(supabaseAdmin, context.userId, "web_bluetooth", "ble_hr", data.device, { reactivate: true });
    if (conn.status === "revoked") await supabaseAdmin.from("wearable_connections").update({ status: "connected" }).eq("id", conn.id);
    return ingestReadings(supabaseAdmin, { userId: context.userId, connectionId: conn.id, device: data.device, readings: [{ metric: "heart_rate", value: data.bpm, unit: "bpm", measured_at: data.measured_at }] });
  });
