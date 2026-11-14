import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { HealthProfile } from "@/lib/profile";
import { completion, completionCardHidden, guidedStepFor, NUDGE_QUESTION } from "@/lib/profile-completion";

const KEY = "anamedis_profile_nudge";

/** Cartão do início: nunca bloqueia nada; some por 30 dias depois de duas dispensas. */
export function ProfileNudge({ profile }: { profile: HealthProfile | null }) {
  const [dismissals, setDismissals] = useState<string[] | null>(null);
  useEffect(() => {
    try { const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]"); setDismissals(Array.isArray(raw) ? raw.filter((x) => typeof x === "string") : []); } catch { setDismissals([]); }
  }, []);
  const c = completion(profile);
  if (dismissals === null || c.percentual >= 100 || completionCardHidden(dismissals)) return null;
  const next = c.faltando[0];
  const step = next ? guidedStepFor(next) : null;
  const dismiss = () => { const n = [...dismissals, new Date().toISOString()].slice(-5); try { localStorage.setItem(KEY, JSON.stringify(n)); } catch { /* sem armazenamento: some só nesta visita */ } setDismissals(n); };
  return (
    <section aria-labelledby="nudge" className="rounded-2xl border bg-card p-5">
      <h2 id="nudge" className="font-display text-xl font-semibold">Seu perfil está {c.percentual}% completo</h2>
      <p className="mt-1 text-sm text-muted-foreground">{c.feitos} de {c.total} itens. {next ? `Próxima pergunta: ${NUDGE_QUESTION[next]}` : ""}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {step ? <Link to="/perfil/guiado" search={{ campo: step }} className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">Responder agora</Link> : <Link to="/perfil" className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">Ver meu perfil</Link>}
        <Link to="/perfil/guiado" className="inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-semibold hover:bg-accent">Prefere responder uma pergunta de cada vez?</Link>
        <button type="button" onClick={dismiss} className="min-h-11 rounded-lg px-4 text-sm font-semibold text-muted-foreground hover:bg-muted">Agora não</button>
      </div>
    </section>
  );
}
