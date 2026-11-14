import { useEffect } from "react";
import { queryOptions, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ReadingRow = { id: string; metric: string; value: number; unit: string; measured_at: string; source_device: string; connection_id: string | null };
export type ConnectionRow = { id: string; provider: string; source: string; display_name: string; status: string; last_sync_at: string | null; last_error: string | null; created_at: string };

export const readingsQuery = (sinceMs: number) => queryOptions({
  queryKey: ["wearable-readings", sinceMs],
  staleTime: 60_000,
  queryFn: async (): Promise<ReadingRow[]> => {
    const since = new Date(Date.now() - sinceMs).toISOString();
    const { data, error } = await supabase.from("wearable_readings").select("id,metric,value,unit,measured_at,source_device,connection_id").gte("measured_at", since).order("measured_at", { ascending: false }).limit(5000);
    if (error) throw error;
    return (data ?? []).map((r) => ({ ...r, value: Number(r.value) }));
  },
});

export const connectionsQuery = queryOptions({
  queryKey: ["wearable-connections"],
  staleTime: 30_000,
  queryFn: async (): Promise<ConnectionRow[]> => {
    const { data, error } = await supabase.from("wearable_connections").select("id,provider,source,display_name,status,last_sync_at,last_error,created_at").order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
});

/** Novas leituras do dono chegam pelo Realtime e atualizam as telas sem recarregar. */
export function useReadingsRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user.id;
      if (!uid || cancelled) return;
      channel = supabase
        .channel(`wearable-${uid}-${Math.random().toString(36).slice(2)}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "wearable_readings", filter: `user_id=eq.${uid}` }, (payload) => {
          const row = payload.new as ReadingRow;
          qc.setQueriesData<ReadingRow[]>({ queryKey: ["wearable-readings"] }, (old) => (old ? [{ ...row, value: Number(row.value) }, ...old.filter((r) => r.id !== row.id)].sort((a, b) => b.measured_at.localeCompare(a.measured_at)) : old));
          void qc.invalidateQueries({ queryKey: ["wearable-connections"] });
        })
        .subscribe();
    });
    return () => { cancelled = true; if (channel) void supabase.removeChannel(channel); };
  }, [qc]);
}
