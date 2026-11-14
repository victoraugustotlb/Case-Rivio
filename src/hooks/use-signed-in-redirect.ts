import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/** Sends a signed-in visitor to the right home exactly once (doctor → /clinico, patient → /inicio). */
export function useSignedInRedirect() {
  const nav = useNavigate();
  const done = useRef(false);
  useEffect(() => {
    const go = async (s: Session | null) => {
      if (!s || done.current) return;
      done.current = true;
      let doctor = s.user.user_metadata?.["account_type"] === "doctor";
      if (!doctor) {
        const { data } = await supabase.from("doctor_profiles").select("user_id").eq("user_id", s.user.id).maybeSingle();
        doctor = !!data;
      }
      nav({ to: doctor ? "/clinico" : "/inicio", replace: true });
    };
    const { data } = supabase.auth.onAuthStateChange((e, s) => {
      if (e === "SIGNED_IN" || e === "INITIAL_SESSION") setTimeout(() => void go(s), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [nav]);
}
