import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { resolveHome } from "@/lib/account.functions";
import { accountQuery } from "@/lib/account-query";

export const INTENT_KEY = "anamedis_entry_path";
export type EntryIntent = "patient_plan" | "patient_individual" | "doctor" | "laboratory";
const INTENTS: readonly string[] = ["patient_plan", "patient_individual", "doctor", "laboratory"];

/**
 * Leva quem está conectado ao destino certo com UMA chamada (resolveHome) e UM redirecionamento.
 * Devolve "verificando" enquanto há sessão e o destino ainda não foi decidido (para mostrar esqueleto).
 */
export function useSignedInRedirect(): "verificando" | "livre" {
  const nav = useNavigate();
  const qc = useQueryClient();
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
      // Tira o token do endereço (o retorno do Google deixa #access_token na barra).
      if (typeof window !== "undefined" && /access_token|refresh_token/.test(window.location.hash)) {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }
      // Uma nova tentativa antes de desistir; se falhar de novo, segue para /inicio, onde o guarda de papel decide
      // (médico vai para /clinico). Nunca volta em silêncio para a tela de entrada com a sessão aberta.
      for (let tentativa = 0; tentativa < 2; tentativa++) {
        try {
          const r = await resolveHome({ data: { intent: tentativa === 0 ? intent : null } });
          qc.setQueryData(accountQuery.queryKey, r.account);
          nav({ to: r.destino, replace: true });
          return;
        } catch (err) {
          console.error("[anamedis] resolveHome falhou", err);
          if (tentativa === 0) await new Promise((ok) => setTimeout(ok, 700));
        }
      }
      nav({ to: "/inicio", replace: true });
    };
    const { data } = supabase.auth.onAuthStateChange((e, s) => {
      if (e === "SIGNED_IN" || e === "INITIAL_SESSION") setTimeout(() => void go(s), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [nav, qc]);
  return state;
}
