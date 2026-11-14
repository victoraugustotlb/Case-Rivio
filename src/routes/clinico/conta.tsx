import { createFileRoute } from "@tanstack/react-router";
import { fmtCnpj, useProMe } from "@/lib/pro-me";
import { ProPage } from "@/components/vita/pro-ui";

export const Route = createFileRoute("/clinico/conta")({
  head: () => ({ meta: [
    { title: "Minha conta — VITA Clínico" }, { name: "description", content: "Dados profissionais informados no cadastro." },
    { property: "og:title", content: "Minha conta — VITA Clínico" }, { property: "og:description", content: "Cadastro profissional informado." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: Conta,
});

function Conta() {
  const { data } = useProMe();
  const d = data?.doctor, l = data?.lab;
  const rows: [string, string][] = d
    ? [["Nome", d.full_name], ["CRM", `${d.crm}/${d.uf} · CRM informado`], ["Especialidade", d.specialty || "—"], ["E-mail", data?.user?.email ?? ""]]
    : l ? [["Razão social", l.legal_name], ["CNPJ", `${fmtCnpj(l.cnpj)} · CNPJ informado`], ["Responsável técnico", `${l.tech_lead_name} (${l.tech_lead_registry})`], ["Cidade", `${l.city}/${l.uf}`], ["E-mail", data?.user?.email ?? ""]] : [];
  return (
    <ProPage title="Minha conta" subtitle="Dados informados por você, ainda sem verificação junto ao conselho ou à Receita.">
      <dl className="max-w-xl divide-y rounded border bg-card">
        {rows.map(([k, v]) => <div key={k} className="grid grid-cols-[160px_1fr] gap-2 px-3 py-2"><dt className="text-xs text-muted-foreground">{k}</dt><dd>{v}</dd></div>)}
      </dl>
    </ProPage>
  );
}
