import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/wearables/webhook/junction")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { junctionProvider } = await import("@/lib/wearable-providers/junction");
        if (!junctionProvider.enabled()) return new Response("desligado", { status: 503 });
        const r = await junctionProvider.tratarWebhook(request); // assinatura conferida antes de ler o JSON
        if (!r.ok) return new Response("recusado", { status: r.status });
        if (!r.clientUserId || !r.source) return new Response("ok"); // evento sem paciente/fonte conhecida: ignora
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: conn } = await supabaseAdmin.from("wearable_connections").select("id,status,user_id").eq("user_id", r.clientUserId).eq("provider", "junction").eq("source", r.source).neq("status", "revoked").order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (!conn) return new Response("ok"); // sem consentimento ativo: não grava nada
        if (r.connectionEvent === "created") await supabaseAdmin.from("wearable_connections").update({ status: "connected", external_user_id: r.externalUserId, last_error: null }).eq("id", conn.id);
        if (r.connectionEvent === "error") await supabaseAdmin.from("wearable_connections").update({ status: "error", last_error: "o provedor recusou a conexão" }).eq("id", conn.id);
        if (r.readings.length) {
          const { ingestReadings } = await import("@/lib/wearables.server");
          await ingestReadings(supabaseAdmin, { userId: conn.user_id, connectionId: conn.id, device: r.device, readings: r.readings.slice(0, 5000) });
        }
        return new Response("ok");
      },
    },
  },
});
