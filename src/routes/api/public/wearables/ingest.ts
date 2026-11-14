import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { INGEST_MAX_READINGS, INGEST_RATE_PER_MIN } from "@/lib/wearables";
import { mapHealthAutoExport } from "@/lib/wearable-providers/health-auto-export";

const Body = z.object({
  device: z.object({ name: z.string().trim().min(1).max(80), model: z.string().trim().max(80).optional() }),
  readings: z.array(z.object({
    metric: z.string().max(40), value: z.number(), unit: z.string().max(16),
    measured_at: z.string().datetime({ offset: true }), external_id: z.string().max(120).optional(),
  })).min(1).max(INGEST_MAX_READINGS),
});

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export const Route = createFileRoute("/api/public/wearables/ingest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Só HTTPS (o localhost do ambiente de desenvolvimento é a exceção).
        const url = new URL(request.url);
        const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
        if (proto !== "https" && url.hostname !== "localhost") return json({ error: "https_obrigatorio" }, 400);
        const auth = request.headers.get("authorization") ?? "";
        const token = /^Bearer\s+(\S+)$/i.exec(auth)?.[1];
        if (!token || token.length < 20 || token.length > 200) return json({ error: "token_invalido" }, 401);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sha256Hex, ingestReadings, ensureConnection } = await import("@/lib/wearables.server");
        const { data: hit } = await supabaseAdmin.rpc("wearable_token_hit", { _hash: await sha256Hex(token), _limit: INGEST_RATE_PER_MIN });
        const t = Array.isArray(hit) ? hit[0] : null;
        if (!t || t.revoked) return json({ error: "token_invalido" }, 401);
        if (!t.allowed) return json({ error: "limite_excedido", retry_after_s: 60 }, 429);
        let raw: unknown;
        try { raw = await request.json(); } catch { return json({ error: "json_invalido" }, 400); }
        // Envio do app Health Auto Export (iPhone / Apple Saúde): formato { data: { metrics: [...] } }.
        const hae = mapHealthAutoExport(raw);
        if (hae) {
          const conn = await ensureConnection(supabaseAdmin, t.owner, "ingest_api", "apple_health", hae.device);
          if (conn.status === "revoked") return json({ error: "conexao_desconectada" }, 409);
          try {
            const total = { accepted: 0, duplicates: 0, rejected: 0 };
            for (let i = 0; i < hae.readings.length; i += INGEST_MAX_READINGS) {
              const r = await ingestReadings(supabaseAdmin, { userId: t.owner, connectionId: conn.id, device: hae.device, readings: hae.readings.slice(i, i + INGEST_MAX_READINGS) });
              total.accepted += r.accepted; total.duplicates += r.duplicates; total.rejected += r.rejected.length;
            }
            return json({ ...total, ignored_metrics: hae.ignoredMetrics });
          } catch { return json({ error: "falha_servidor" }, 500); }
        }
        const parsed = Body.safeParse(raw);
        if (!parsed.success) return json({ error: "corpo_invalido", issues: parsed.error.issues.slice(0, 5).map((i) => ({ path: i.path.join("."), message: i.message })) }, 400);
        const device = parsed.data.device.model ? `${parsed.data.device.name} (${parsed.data.device.model})` : parsed.data.device.name;
        const conn = await ensureConnection(supabaseAdmin, t.owner, "ingest_api", "outro", device);
        if (conn.status === "revoked") return json({ error: "conexao_desconectada" }, 409);
        try {
          const r = await ingestReadings(supabaseAdmin, { userId: t.owner, connectionId: conn.id, device, readings: parsed.data.readings });
          return json(r);
        } catch { return json({ error: "falha_servidor" }, 500); }
      },
    },
  },
});
