import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { AccessStatus } from "@/components/vita/AccessStatus";
import { AppShell, PageTitle } from "@/components/vita/AppShell";
import { HealthProfileEditor } from "@/components/vita/HealthProfileEditor";
import { ProfileOverview } from "@/components/vita/ProfileOverview";
import { ProfileSettings } from "@/components/vita/ProfileSettings";
import { healthProfileQuery } from "@/lib/profile-query";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "Meu perfil de saúde — Anamedis" },
      { name: "description", content: "Seu perfil privado com medidas, medicamentos, alergias e questionário inicial de saúde." },
      { property: "og:title", content: "Meu perfil de saúde — Anamedis" },
      { property: "og:description", content: "Registre suas informações pessoais e seu histórico de saúde no Anamedis." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(healthProfileQuery),
  errorComponent: ProfileError,
  notFoundComponent: () => <AppShell><PageTitle title="Perfil não encontrado" /></AppShell>,
  component: Perfil,
});

function Perfil() {
  const { data } = useSuspenseQuery(healthProfileQuery);
  const { user } = Route.useRouteContext();
  return (
    <AppShell>
      <div className="mx-auto max-w-4xl">
        <PageTitle title="Perfil" subtitle="Sua conta, suas informações e seu histórico de saúde" />
        <section aria-labelledby="conta" className="mb-8 space-y-2">
          <h2 id="conta" className="font-display text-lg font-semibold">Conta</h2>
          <AccessStatus detailed />
        </section>
        <ProfileOverview profile={data} />
        <ProfileSettings />
        <h2 id="editar" className="mb-3 mt-10 font-display text-xl font-bold">Editar tudo</h2>
        <HealthProfileEditor initial={data} accountName={typeof user.user_metadata["full_name"] === "string" ? user.user_metadata["full_name"] : ""} />
      </div>
    </AppShell>
  );
}

function ProfileError() {
  const router = useRouter();
  return <AppShell><div className="mx-auto max-w-4xl"><PageTitle title="Perfil" /><p role="alert" className="mb-4 text-destructive">Não foi possível carregar suas informações.</p><Button onClick={() => void router.invalidate()}>Tentar novamente</Button></div></AppShell>;
}
