import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { AppShell } from "@/components/vita/AppShell";
import { GUIDED_ORDER, GuidedProfile } from "@/components/vita/GuidedProfile";
import { emptyProfile } from "@/lib/profile";
import { patchHealthProfile } from "@/lib/profile.functions";
import { healthProfileQuery } from "@/lib/profile-query";
import { profileOverviewQuery } from "@/lib/patient-settings-query";
import { requireRole } from "@/lib/require-role";

export const Route = createFileRoute("/_authenticated/perfil_/guiado")({
  head: () => ({
    meta: [
      { title: "Perfil em modo simples — Anamedis" },
      { name: "description", content: "Responda uma pergunta de cada vez, com botões grandes, para completar seu perfil de saúde." },
      { property: "og:title", content: "Perfil em modo simples — Anamedis" },
      { property: "og:description", content: "Uma pergunta por tela para completar seu perfil de saúde." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => z.object({ campo: z.enum(GUIDED_ORDER).optional() }).catch({}).parse(s),
  beforeLoad: ({ context }) => requireRole("paciente", context),
  loader: ({ context }) => context.queryClient.ensureQueryData(healthProfileQuery),
  component: Guiado,
});

function Guiado() {
  const { campo } = Route.useSearch();
  const { data } = useSuspenseQuery(healthProfileQuery);
  const { user } = Route.useRouteContext();
  const patch = useServerFn(patchHealthProfile);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const accountName = typeof user.user_metadata["full_name"] === "string" ? user.user_metadata["full_name"] : "";
  return (
    <AppShell>
      <GuidedProfile
        profile={data ?? { ...emptyProfile, full_name: accountName }}
        {...(campo ? { startAt: campo } : {})}
        save={async (p) => {
          const r = await patch({ data: { patch: p, accountName } });
          if (r.ok) { qc.setQueryData(healthProfileQuery.queryKey, r.profile); void qc.invalidateQueries({ queryKey: profileOverviewQuery.queryKey }); }
          return r;
        }}
        onFinish={() => void navigate({ to: "/perfil" })}
      />
    </AppShell>
  );
}
