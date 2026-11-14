import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { homeFor, type AccountType } from "@/lib/accounts";
import { choosePatientPath, chooseProfessionalType } from "@/lib/account.functions";

export const INTENT_KEY = "vita_entry_path";
export type EntryIntent = "patient_plan" | "patient_individual" | "doctor" | "laboratory";

/** Leva quem está conectado à tela certa uma única vez: pacientes → /inicio (plano sem vínculo → /plano), profissionais → /clinico. */
export function useSignedInRedirect() {
  const nav = useNavigate();
  const done = useRef(false);
  useEffect(() => {
    const go = async (s: Session | null) => {
      if (!s || done.current) return;
      done.current = true;
      const intent = localStorage.getItem(INTENT_KEY) as EntryIntent | null;
      localStorage.removeItem(INTENT_KEY);
      try {
        if (intent === "patient_plan" || intent === "patient_individual") await choosePatientPath({ data: { type: intent } });
        else if (intent === "doctor" || intent === "laboratory") await chooseProfessionalType({ data: { type: intent } }).catch(() => undefined);
      } catch { /* conta profissional entrando pelo caminho de paciente: mantém o tipo atual */ }
      const { data } = await supabase.from("profiles").select("account_type").eq("user_id", s.user.id).maybeSingle();
      const type = (data?.account_type ?? null) as AccountType | null;
      if (type === "patient_plan") {
        const { data: m } = await supabase.from("plan_memberships").select("id").eq("user_id", s.user.id).maybeSingle();
        if (!m) { nav({ to: "/plano", replace: true }); return; }
      }
      nav({ to: homeFor(type), replace: true });
    };
    const { data } = supabase.auth.onAuthStateChange((e, s) => {
      if (e === "SIGNED_IN" || e === "INITIAL_SESSION") setTimeout(() => void go(s), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [nav]);
}
