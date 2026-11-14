import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { resolveHome } from "@/lib/account.functions";

export const INTENT_KEY = "vita_entry_path";
export type EntryIntent = "patient_plan" | "patient_individual" | "doctor" | "laboratory";
const INTENTS: readonly string[] = ["patient_plan", "patient_individual", "doctor", "laboratory"];

/**
 * Leva quem está conectado ao destino certo com UMA chamada (resolveHome) e UM redirecionamento.
 * Devolve "verificando" enquanto há sessão e o destino ainda não foi decidido (para mostrar esqueleto).
 */
export function useSignedInRedirect(): "verificando" | "livre" {
  const nav = useNavigate();
  const done = useRef(false);
  const [state, setState] = useState<"verificando" | "livre">("livre");
  useEffect(() => {
    const go = async (s: Session | null) => {
      if (!s || done.current) { if (!s) setState("livre"); return; }
      done.current = true;
      setState("verificando");
      // Lê e apaga a intenção ANTES de qualquer await: sobra antiga nunca dispara nada depois.
      const stored = localStorage.getItem(INTENT_KEY);
      localStorage.removeItem(INTENT_KEY);
      const intent = stored && INTENTS.includes(stored) ? (stored as EntryIntent) : null;
      try {
        const r = await resolveHome({ data: { intent } });
        nav({ to: r.destino, replace: true });
      } catch { done.current = false; setState("livre"); }
    };
    const { data } = supabase.auth.onAuthStateChange((e, s) => {
      if (e === "SIGNED_IN" || e === "INITIAL_SESSION") setTimeout(() => void go(s), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [nav]);
  return state;
}
