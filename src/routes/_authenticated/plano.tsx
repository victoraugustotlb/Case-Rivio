import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ShieldCheck } from "lucide-react";
import { AppShell, PageTitle } from "@/components/vita/AppShell";
import { listPlans, validatePlanMembership, choosePatientPath } from "@/lib/account.functions";
import { accountQuery } from "@/lib/account-query";
import { requireRole } from "@/lib/require-role";

export const Route = createFileRoute("/_authenticated/plano")({
  beforeLoad: ({ context }) => requireRole("paciente", context),
  head: () => ({
    meta: [
      { title: "Plano de saúde — Anamedis" },
      { name: "description", content: "Vincule a carteirinha do seu plano de saúde para usar o Anamedis sem cobrança." },
      { property: "og:title", content: "Plano de saúde — Anamedis" },
      { property: "og:description", content: "Acesso ao Anamedis oferecido pela operadora, com o mesmo controle do paciente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Plano,
});

function Plano() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const fetchPlans = useServerFn(listPlans);
  const validate = useServerFn(validatePlanMembership);
  const choose = useServerFn(choosePatientPath);
  const plans = useQuery({ queryKey: ["insurance-plans"], queryFn: () => fetchPlans() });
  const account = useQuery(accountQuery);
  const [planId, setPlanId] = useState("");
  const [card, setCard] = useState("");
  const [role, setRole] = useState<"titular" | "dependente">("titular");
  const [holder, setHolder] = useState("");
  const [msg, setMsg] = useState<{ tipo: "erro" | "ok"; texto: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const input = "mt-1 min-h-11 w-full rounded-lg border bg-card px-3";
  const m = account.data?.membership;
  const selected = planId || plans.data?.[0]?.id || "";

  return (
    <AppShell>
      <div className="mx-auto max-w-xl">
        <PageTitle title="Plano de saúde" subtitle="Plano oferecido pela operadora. Não há cobrança para você." />
        {m && (
          <div className="mb-6 rounded-xl border bg-card p-4 text-sm">
            <p className="flex items-center gap-2 font-medium"><ShieldCheck className="h-4 w-4 text-primary" aria-hidden />Seu acesso é oferecido por {m.planName}.</p>
            <p className="mt-1 text-muted-foreground">{m.role === "titular" ? "Titular" : "Dependente"} · {m.status === "active" ? "Vínculo ativo" : m.status === "pending" ? "Aguardando aprovação do titular" : "Vínculo recusado"}</p>
            <p className="mt-1 text-xs text-muted-foreground">A operadora não recebe acesso ao seu histórico.</p>
          </div>
        )}
        <form className="space-y-4" onSubmit={async (e) => {
          e.preventDefault(); setMsg(null); setBusy(true);
          try {
            const r = await validate({ data: { planId: selected, card, role, holderCard: role === "dependente" ? holder : null } });
            if (!r.ok) setMsg({ tipo: "erro", texto: r.error });
            else {
              await qc.invalidateQueries({ queryKey: ["account"] });
              if (r.status === "active") await nav({ to: "/inicio" });
              else setMsg({ tipo: "ok", texto: "Vínculo registrado. Ele fica pendente até o titular aprovar." });
            }
          } catch { setMsg({ tipo: "erro", texto: "Não foi possível validar agora. Tente novamente." }); } finally { setBusy(false); }
        }}>
          <label className="block"><span className="text-sm font-medium">Operadora</span>
            <select value={selected} onChange={(e) => setPlanId(e.target.value)} className={input} disabled={plans.isLoading}>
              {(plans.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}{p.is_demo ? " (demonstração)" : ""}</option>)}
            </select></label>
          <label className="block"><span className="text-sm font-medium">Número da carteirinha</span><input required inputMode="numeric" value={card} onChange={(e) => setCard(e.target.value)} placeholder="Somente números" className={input} /></label>
          <fieldset>
            <legend className="text-sm font-medium">Você é</legend>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {([["titular", "Sou titular"], ["dependente", "Sou dependente"]] as const).map(([k, l]) => (
                <label key={k} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm ${role === k ? "border-primary bg-primary-soft text-primary" : "bg-card"}`}>
                  <input type="radio" name="role" checked={role === k} onChange={() => setRole(k)} />{l}
                </label>
              ))}
            </div>
          </fieldset>
          {role === "dependente" && <label className="block"><span className="text-sm font-medium">Carteirinha do titular</span><input required inputMode="numeric" value={holder} onChange={(e) => setHolder(e.target.value)} className={input} /><span className="mt-1 block text-xs text-muted-foreground">O titular precisará aprovar o vínculo.</span></label>}
          {msg && <p role={msg.tipo === "erro" ? "alert" : "status"} className={`rounded-lg p-3 text-sm ${msg.tipo === "erro" ? "bg-danger-soft" : "bg-success-soft"}`}>{msg.texto}</p>}
          <button disabled={busy || !selected} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary font-semibold text-primary-foreground disabled:opacity-60">{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Validar carteirinha</button>
          <p className="text-xs text-muted-foreground">Enviamos à operadora apenas o número da carteirinha. Nenhum dado de saúde é compartilhado com ela.</p>
        </form>
        <button type="button" onClick={async () => { await choose({ data: { type: "patient_individual" } }); await qc.invalidateQueries({ queryKey: ["account"] }); await nav({ to: "/assinatura" }); }} className="mt-6 text-sm text-muted-foreground underline">Não tenho plano: usar a assinatura individual</button>
      </div>
    </AppShell>
  );
}
