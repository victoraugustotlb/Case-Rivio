import { createFileRoute } from "@tanstack/react-router";
import { ChevronRight, Download, History, KeyRound, ShieldCheck, Trash2, User } from "lucide-react";
import { AppShell, PageTitle } from "@/components/vita/AppShell";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "Perfil e privacidade — VITA" },
      { name: "description", content: "Dados pessoais, histórico de acessos, segurança e seus direitos sobre os dados." },
      { property: "og:title", content: "Perfil e privacidade — VITA" },
      { property: "og:description", content: "Controle quem vê seus dados de saúde." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Perfil,
});

const items = [
  { label: "Dados pessoais", icon: User },
  { label: "Histórico de acessos dos médicos", icon: History },
  { label: "Consentimentos", icon: ShieldCheck },
  { label: "Segurança e biometria", icon: KeyRound },
  { label: "Baixar meus dados", icon: Download },
  { label: "Excluir conta", icon: Trash2, danger: true },
];

function Perfil() {
  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <PageTitle title="Perfil" subtitle="Sua conta e privacidade" />
        <section className="rounded-2xl border bg-card p-5">
          <h2 className="font-semibold">Acessos recentes</h2>
          <ul className="mt-3 divide-y text-sm">
            <li className="flex justify-between gap-3 py-3"><span>Código K7PM-4XQ2 · exames e pressão</span><span className="text-muted-foreground">06 nov · encerrado</span></li>
            <li className="flex justify-between gap-3 py-3"><span>Código R3WD-8HNA · documentos</span><span className="text-muted-foreground">10 dez 2025 · expirado</span></li>
          </ul>
        </section>
        <ul className="mt-6 overflow-hidden rounded-2xl border bg-card">
          {items.map(({ label, icon: Icon, danger }) => (
            <li key={label} className="border-b last:border-0">
              <button type="button" className={`flex min-h-14 w-full items-center gap-3 px-5 text-left font-medium hover:bg-muted ${danger ? "text-destructive" : ""}`}>
                <Icon className="h-5 w-5" aria-hidden /><span className="flex-1">{label}</span><ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </AppShell>
  );
}
