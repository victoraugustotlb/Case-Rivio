import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronRight, Eye, EyeOff, FileText, FolderHeart, ScanLine, Share2 } from "lucide-react";
import { AppShell } from "@/components/vita/AppShell";
import { useSuspenseQuery } from "@tanstack/react-query";
import { documentsQuery } from "@/lib/documents";
import { supabase } from "@/integrations/supabase/client";
import { healthProfileQuery } from "@/lib/profile-query";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/require-role";
import { destinationFor } from "@/lib/routing";
import { AccessStatus } from "@/components/vita/AccessStatus";
import { NotificationsCard, PendingUploads } from "@/components/vita/PatientInbox";
import { WearableHomeCard } from "@/components/vita/WearableHomeCard";

export const Route = createFileRoute("/_authenticated/inicio")({
  head: () => ({
    meta: [
      { title: "Início — Anamedis" },
      { name: "description", content: "Seus exames, laudos, consultas antigas e dados de wearables reunidos para mostrar ao médico com um código." },
      { property: "og:title", content: "Início — Anamedis" },
      { property: "og:description", content: "Seu histórico de saúde completo em um só lugar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: async ({ context }) => {
    const { account } = await requireRole("paciente", context);
    // Plano sem carteirinha: mesma regra do pós-login (destinationFor).
    if (destinationFor({ accountType: account.type, temVinculoPlano: !!account.membership }) === "/plano") throw redirect({ to: "/plano", replace: true });
  },
  loader: async ({ context }) => {
    // O perfil nunca bloqueia o app: sem perfil, o cartão "Complete seu perfil" aparece aqui.
    await Promise.all([context.queryClient.ensureQueryData(healthProfileQuery), context.queryClient.ensureQueryData(documentsQuery)]);
  },
  errorComponent: () => <AppShell><p role="alert">Não foi possível carregar seu histórico. Atualize a página para tentar novamente.</p></AppShell>,
  notFoundComponent: () => <AppShell><p>Página não encontrada.</p></AppShell>,
  component: Inicio,
});

function Inicio() {
  const [hidden, setHidden] = useState(true);
  const { data: docs } = useSuspenseQuery(documentsQuery);
  const { data: profile } = useSuspenseQuery(healthProfileQuery);
  const [nome, setNome] = useState("");
  useEffect(() => { supabase.auth.getSession().then(({ data }) => setNome(((data.session?.user.user_metadata?.["full_name"] as string) || "").split(" ")[0] ?? "")); }, []);
  const counts = { exames: docs.filter((d) => d.kind === "Exame" || d.kind === "Laudo").length, total: docs.length, pend: 0 };
  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">Olá,</p>
            <h1 className="truncate font-display text-3xl font-bold tracking-tight lg:text-4xl">{nome || "Bem-vindo(a)"}</h1>
          </div>
          <button type="button" onClick={() => setHidden((h) => !h)} aria-pressed={!hidden}
            className="flex min-h-11 items-center gap-2 rounded-full border bg-card px-4 text-sm font-medium hover:bg-muted">
            {hidden ? <Eye className="h-4 w-4" aria-hidden /> : <EyeOff className="h-4 w-4" aria-hidden />}
            {hidden ? "Mostrar nomes" : "Ocultar nomes"}
          </button>
        </section>

        <AccessStatus />
        <PendingUploads />
        <NotificationsCard />

        {!profile?.questionnaire_completed && <section className="flex flex-wrap items-center justify-between gap-4 border-y py-5">
          <div><h2 className="font-display text-xl font-semibold">Complete seu perfil</h2><p className="mt-1 text-sm text-muted-foreground">Questionário inicial · Medidas, medicamentos e histórico</p></div>
          <Button asChild className="min-h-11"><Link to="/perfil">Preencher perfil<ChevronRight aria-hidden /></Link></Button>
        </section>}

        <section className="grid gap-4 lg:grid-cols-3">
          <article className="bg-hero rounded-2xl p-6 text-primary-foreground shadow-soft lg:col-span-2">
            <p className="text-sm font-medium opacity-80">Vai a uma consulta?</p>
            <h2 className="mt-2 font-display text-2xl font-semibold">Mostre todo o seu histórico ao médico com um código</h2>
            <p className="mt-1 opacity-90">Você escolhe o que ele vê e por quanto tempo. Evita repetir exames que você já fez.</p>
            <Link to="/compartilhar" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary-foreground px-4 font-semibold text-primary">
              <Share2 className="h-4 w-4" aria-hidden /> Gerar código para o médico
            </Link>
            <Link to="/autorizar" className="ml-2 mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-primary-foreground/40 px-4 font-semibold">
              Recebi um código do médico
            </Link>
          </article>
          <article className="rounded-2xl border bg-card p-6 shadow-soft">
            <h2 className="font-semibold">Seu histórico</h2>
            <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div><dt className="text-xs text-muted-foreground">Documentos</dt><dd className="font-display text-2xl font-semibold">{counts.total}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Exames</dt><dd className="font-display text-2xl font-semibold">{counts.exames}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Recentes</dt><dd className="font-display text-2xl font-semibold">{Math.min(docs.length, 4)}</dd></div>
            </dl>
            {counts.pend > 0 && (
              <Link to="/documentos" className="mt-5 flex min-h-11 items-center justify-between rounded-lg bg-warning-soft px-3 text-sm font-medium text-warning">
                {counts.pend} documento para conferir <ChevronRight className="h-4 w-4" aria-hidden />
              </Link>
            )}
          </article>
        </section>

        <WearableHomeCard />

        <section aria-labelledby="add">
          <h2 id="add" className="mb-3 font-display text-xl font-semibold">Adicionar ao histórico</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Adicionar documento", hint: "Exame, laudo, receita — PDF ou foto", icon: ScanLine, to: "/documentos/adicionar" },
              { label: "Ver documentos", hint: "Biblioteca completa", icon: FolderHeart, to: "/documentos" },
            ].map(({ label, hint, icon: Icon, to }) => (
              <Link key={label} to={to} className="flex min-h-28 flex-col justify-between rounded-2xl border bg-card p-4 transition-colors hover:border-primary hover:bg-primary-soft">
                <Icon className="h-5 w-5 text-primary" aria-hidden />
                <span><span className="block font-medium">{label}</span><span className="text-xs text-muted-foreground">{hint}</span></span>
              </Link>
            ))}
          </div>
        </section>

        <div className="grid gap-6">
          <section aria-labelledby="recentes">
            <h2 id="recentes" className="mb-3 font-display text-xl font-semibold">Adicionados recentemente</h2>
            <ol className="rounded-2xl border bg-card p-2">
              {docs.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">Nenhum documento ainda. <Link to="/documentos/adicionar" className="font-medium text-primary underline">Adicione o primeiro</Link>.</li>}
              {docs.slice(0, 4).map((d) => (
                <li key={d.id}>
                  <Link to="/documentos/$id" params={{ id: d.id }} className="flex items-center gap-3 rounded-xl p-3 hover:bg-muted">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary"><FileText className="h-5 w-5" aria-hidden /></span>
                    <div className="min-w-0 flex-1">
                      <p className={`truncate font-medium ${hidden ? "sensitive-blur" : ""}`}>{d.title}</p>
                      <p className="text-sm text-muted-foreground">{[d.kind, d.source, d.doc_date].filter(Boolean).join(" · ")}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
