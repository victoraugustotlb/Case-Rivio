import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, LockKeyhole, ShieldCheck } from "lucide-react";
import { accountQuery } from "@/lib/account-query";
import { formatPrice } from "@/lib/pricing";

const fmt = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString("pt-BR") : "");

/** Linha discreta com o vínculo do plano ou o estado da assinatura. Nunca ocupa a tela. */
export function AccessStatus({ detailed = false }: { detailed?: boolean }) {
  const { data: a } = useQuery(accountQuery);
  if (!a || (a.type !== "patient_plan" && a.type !== "patient_individual")) return null;
  let text: string;
  let sub = "";
  let link: { to: "/plano" | "/assinatura"; label: string } | null = null;
  if (a.type === "patient_plan") {
    if (!a.membership) { text = "Informe sua carteirinha para ativar o acesso pelo plano."; link = { to: "/plano", label: "Informar carteirinha" }; }
    else {
      text = `Seu acesso é oferecido por ${a.membership.planName ?? "sua operadora"}.`;
      sub = a.membership.status === "pending" ? "Vínculo de dependente aguardando aprovação do titular." : "A operadora não recebe acesso ao seu histórico.";
      if (a.membership.status === "pending") sub += " A operadora não recebe acesso ao seu histórico.";
      if (detailed) link = { to: "/plano", label: "Ver vínculo" };
    }
  } else if (a.exempt && a.subscriptionState === "sem_assinatura") {
    text = "Assinatura individual · sem cobrança para sua conta.";
    if (detailed) link = { to: "/assinatura", label: "Assinatura e pagamento" };
  } else {
    const s = a.subscription;
    text = a.subscriptionState === "ativa" ? `Assinatura individual ativa · próxima cobrança em ${fmt(s?.current_period_end)}`
      : a.subscriptionState === "cancelando" ? `Assinatura cancelada · acesso completo até ${fmt(s?.current_period_end)}`
      : a.subscriptionState === "vencida" ? "Assinatura vencida · você continua vendo seus documentos."
      : `Assinatura individual · ${formatPrice()}/mês`;
    if (!a.canWrite) sub = "Envio de documentos e novos códigos ficam pausados até regularizar.";
    link = { to: "/assinatura", label: detailed ? "Assinatura e pagamento" : a.canWrite ? "Detalhes" : "Regularizar" };
  }
  const Icon = a.type === "patient_plan" ? ShieldCheck : CreditCard;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border bg-card px-4 py-3 text-sm">
      <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0 flex-1"><p>{text}</p>{sub && <p className="text-xs text-muted-foreground">{sub}</p>}</div>
      {link && <Link to={link.to} className="font-medium text-primary underline-offset-2 hover:underline">{link.label}</Link>}
    </div>
  );
}

/** Mostra o aviso e esconde a ação quando o paciente não pode enviar ou gerar códigos. */
export function WriteGate({ action, children }: { action: string; children: React.ReactNode }) {
  const { data: a, isLoading } = useQuery(accountQuery);
  if (isLoading || !a || a.canWrite) return <>{children}</>;
  const plan = a.type === "patient_plan";
  return (
    <div role="status" className="rounded-2xl border bg-card p-6">
      <LockKeyhole className="h-6 w-6 text-primary" aria-hidden />
      <h2 className="mt-3 font-display text-xl font-semibold">{action} está pausado</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {plan ? (a.membership?.status === "pending" ? "Seu vínculo de dependente aguarda a aprovação do titular." : "Ative seu acesso pelo plano informando a carteirinha.") : "Regularize sua assinatura individual para continuar."} Seus documentos continuam guardados e você pode vê-los e baixá-los normalmente.
      </p>
      <Link to={plan ? "/plano" : "/assinatura"} className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-primary px-4 font-semibold text-primary-foreground">{plan ? "Informar carteirinha" : "Ver assinatura"}</Link>
    </div>
  );
}
