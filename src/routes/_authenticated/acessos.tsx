import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Eye, Loader2 } from "lucide-react";
import { AppShell, PageTitle } from "@/components/vita/AppShell";
import { NotificationsCard } from "@/components/vita/PatientInbox";
import { listAccessLog } from "@/lib/patient-inbox.functions";

export const Route = createFileRoute("/_authenticated/acessos")({
  head: () => ({
    meta: [
      { title: "Acessos ao meu histórico — Anamedis" },
      { name: "description", content: "Veja quem abriu seu histórico, seus documentos ou enviou arquivos, e quando." },
      { property: "og:title", content: "Acessos ao meu histórico — Anamedis" },
      { property: "og:description", content: "Registro de cada acesso de profissionais e familiares." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Acessos,
});

function Acessos() {
  const fn = useServerFn(listAccessLog);
  const q = useQuery({ queryKey: ["access-log"], queryFn: () => fn() });
  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <PageTitle title="Acessos" subtitle="Cada abertura do seu histórico ou envio de documento fica registrada aqui." />
        <NotificationsCard />
        {q.isLoading ? <Loader2 className="h-5 w-5 animate-spin text-primary" aria-label="Carregando" /> : (q.data ?? []).length === 0 ? (
          <p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">Ninguém acessou seu histórico ainda.</p>
        ) : (
          <ul className="divide-y rounded-2xl border bg-card">
            {q.data!.map((l) => (
              <li key={l.id} className="flex items-start gap-3 p-4 text-sm">
                <Eye className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="flex-1"><strong>{l.who}</strong> {l.what}</span>
                <time className="shrink-0 text-muted-foreground">{new Date(l.at).toLocaleString("pt-BR")}</time>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
