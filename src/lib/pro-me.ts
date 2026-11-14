import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Quem está conectado na área profissional (cria o cadastro a partir dos dados da inscrição, se faltar). */
export function useProMe() {
  return useQuery({
    queryKey: ["doctor-me"],
    queryFn: async () => {
      const { data: s } = await supabase.auth.getSession();
      const u = { user: s.session?.user ?? null };
      if (!u.user) return { user: null, doctor: null, lab: null, type: null };
      const { data: prof } = await supabase.from("profiles").select("account_type").eq("user_id", u.user.id).maybeSingle();
      if (prof?.account_type === "laboratory") {
        let { data: lab } = await supabase.from("lab_profiles").select("*").eq("user_id", u.user.id).maybeSingle();
        const l = (u.user.user_metadata as Record<string, unknown>)["lab"] as Record<string, string> | undefined;
        if (!lab && l?.["cnpj"]) {
          const { data } = await supabase.from("lab_profiles").insert({ legal_name: l["legal_name"] ?? "", cnpj: l["cnpj"], tech_lead_name: l["tech_lead_name"] ?? "", tech_lead_registry: l["tech_lead_registry"] ?? "", city: l["city"] ?? "", uf: l["uf"] ?? "SP" }).select("*").single();
          lab = data;
        }
        return { user: u.user, doctor: null, lab, type: "laboratory" as const };
      }
      if (prof?.account_type === "patient_plan" || prof?.account_type === "patient_individual") return { user: u.user, doctor: null, lab: null, type: "patient" as const };
      let { data: doctor } = await supabase.from("doctor_profiles").select("*").eq("user_id", u.user.id).maybeSingle();
      const m = u.user.user_metadata as Record<string, string | undefined>;
      if (!doctor && m["account_type"] === "doctor" && m["crm"] && m["uf"]) {
        const { data } = await supabase.from("doctor_profiles").insert({ full_name: m["full_name"] ?? "", crm: m["crm"], uf: m["uf"], specialty: m["specialty"] ?? "" }).select("*").single();
        doctor = data;
      }
      return { user: u.user, doctor, lab: null, type: "doctor" as const };
    },
  });
}

export const fmtCnpj = (c: string) => c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
