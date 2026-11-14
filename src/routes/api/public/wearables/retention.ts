import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { WEARABLE_RETENTION_DAYS } from "@/lib/wearables";

/** Agendado 1x por dia: apaga leituras de dispositivo mais antigas que o prazo de retenção. */
export const Route = createFileRoute("/api/public/wearables/retention")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const cutoff = new Date(Date.now() - WEARABLE_RETENTION_DAYS * 86_400_000).toISOString();
        const { error } = await supabaseAdmin.from("wearable_readings").delete().lt("measured_at", cutoff);
        return Response.json({ success: !error });
      },
    },
  },
});
