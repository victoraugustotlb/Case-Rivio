import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { DocField } from "@/lib/vita-data";

export type VitaDoc = {
  id: string; title: string; kind: string; doc_date: string | null; source: string | null;
  origin: string; file_path: string | null; file_type: string | null; fields: DocField[];
  summary: string | null; confirmed: boolean; created_at: string;
  status: string; uploaded_by: string | null; uploaded_by_name: string | null; note: string | null;
};

export const documentsQuery = queryOptions({
  queryKey: ["documents"],
  queryFn: async (): Promise<VitaDoc[]> => {
    const { data, error } = await supabase.from("documents").select("*").eq("status", "accepted").order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as VitaDoc[];
  },
});

export const documentQuery = (id: string) => queryOptions({
  queryKey: ["documents", id],
  queryFn: async () => {
    const { data, error } = await supabase.from("documents").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const doc = data as unknown as VitaDoc;
    let url: string | null = null;
    if (doc.file_path) {
      const s = await supabase.storage.from("medical-documents").createSignedUrl(doc.file_path, 600);
      url = s.data?.signedUrl ?? null;
    }
    return { ...doc, url };
  },
});
