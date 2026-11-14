import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, CreditCard, ShieldCheck } from "lucide-react";
import { AppShell, PageTitle } from "@/components/vita/AppShell";
import { accountQuery } from "@/lib/account-query";
import { formatPrice, INDIVIDUAL_PLAN } from "@/lib/pricing";

export const Route = createFileRoute("/_authenticated/assinatura")({
  head: () => ({
    meta: [
      { title: "Assinatura e pagamento — VITA" },
      { name: "description", content: "Assinatura individual do VITA: preço, o que está incluso e a situação do seu pagamento." },
      { property: "og:title", content: "Assinatura individual — VITA" },
      { property: "og:description", content: "Mesma segurança e mesmo controle do acesso pelo plano." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Assinatura,
});

const INCLUDED = ["Documentos e exames guardados sem limite de tempo", "Leitura automática dos documentos, sempre conferida por você", "Códigos temporários para o médico, com escopo e validade que você escolhe", "Registro de cada acesso ao seu histórico", "Exportação dos seus documentos a qualquer momento"];
const fmt = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");

function Assinatura() {
  const { data: a } = useQuery(accountQuery);
  const s = a?.subscription;
  const stateLabel = { ativa: "Ativa", cancelando: "Cancelada ao fim do período", vencida: "Vencida", sem_assinatura: a?.exempt ? "Sem cobrança para sua conta" : "Ainda não assinada" }[a?.subscriptionState ?? "sem_assinatura"];
  return (
    <AppShell>
      <div className="mx-auto max-w-4xl">
        <PageTitle title="Assinatura e pagamento" subtitle={INDIVIDUAL_PLAN.label} />
        {a?.type === "patient_plan" && <p className="mb-6 rounded-xl border bg-card p-4 text-sm">Seu acesso é oferecido por {a.membership?.planName ?? "sua operadora"}. Não há cobrança para você. <Link to="/plano" className="text-primary underline">Ver vínculo</Link></p>}
        <div className="grid gap-6 md:grid-cols-[1fr_1fr]">
          <section className="rounded-2xl border bg-card p-6 shadow-soft">
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">Assinatura individual</p>
            <p className="mt-3 font-display text-5xl font-bold">{formatPrice()}<span className="text-lg font-medium text-muted-foreground">/{INDIVIDUAL_PLAN.interval}</span></p>
            <p className="mt-3 flex items-start gap-2 text-sm"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />Mesma segurança e mesmo controle do acesso pelo plano.</p>
            <ul className="mt-5 space-y-2 text-sm">{INCLUDED.map((i) => <li key={i} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />{i}</li>)}</ul>
            <button type="button" disabled className="mt-6 min-h-12 w-full rounded-lg bg-primary font-semibold text-primary-foreground disabled:opacity-50">Assinar com cartão ou Pix</button>
            <p className="mt-2 text-center text-xs text-muted-foreground">O pagamento ainda não está ativado neste app.</p>
          </section>
          <section className="rounded-2xl border bg-card p-6">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><CreditCard className="h-5 w-5 text-primary" aria-hidden />Sua situação</h2>
            <dl className="mt-4 grid grid-cols-[9rem_1fr] gap-y-2 text-sm">
              <dt className="text-muted-foreground">Situação</dt><dd className="font-medium">{stateLabel}</dd>
              <dt className="text-muted-foreground">Período atual até</dt><dd>{fmt(s?.current_period_end)}</dd>
              <dt className="text-muted-foreground">Próxima cobrança</dt><dd>{a?.subscriptionState === "ativa" ? fmt(s?.current_period_end) : "—"}</dd>
            </dl>
            {a && !a.canWrite && a.type === "patient_individual" && <p className="mt-4 rounded-lg bg-warning-soft p-3 text-sm">Você continua vendo e baixando seus documentos. Envio de novos documentos e novos códigos voltam quando a assinatura for regularizada. Nada é apagado por falta de pagamento.</p>}
            <p className="mt-4 text-xs text-muted-foreground">Seus documentos continuam guardados em qualquer situação.</p>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
