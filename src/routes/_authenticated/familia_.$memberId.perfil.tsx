import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Lock } from "lucide-react";
import { AppShell } from "@/components/vita/AppShell";
import { GuidedProfile } from "@/components/vita/GuidedProfile";
import { emptyProfile } from "@/lib/profile";
import { getMemberProfileForEdit, saveMemberProfile } from "@/lib/family.functions";

export const Route = createFileRoute("/_authenticated/familia_/$memberId/perfil")({
  head: () => ({
    meta: [
      { title: "Ajudar a preencher o perfil — Anamedis" },
      { name: "description", content: "Preencha o perfil de saúde de um familiar que autorizou sua ajuda. Cada alteração fica registrada." },
      { property: "og:title", content: "Ajudar a preencher o perfil — Anamedis" },
      { property: "og:description", content: "Ajuda de pessoa de confiança no perfil de saúde, com registro." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MemberEdit,
});

function MemberEdit() {
  const { memberId } = Route.useParams();
  const get = useServerFn(getMemberProfileForEdit);
  const save = useServerFn(saveMemberProfile);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ["family", "member-edit", memberId], queryFn: () => get({ data: { memberId } }) });
  if (q.isPending) return <AppShell><p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Carregando…</p></AppShell>;
  if (q.isError || !q.data?.ok) return (
    <AppShell>
      <div className="mx-auto max-w-xl rounded-2xl border bg-card p-6">
        <Lock className="h-7 w-7 text-muted-foreground" aria-hidden />
        <p className="mt-2 font-semibold">Você não tem permissão para editar este perfil.</p>
        <p className="mt-1 text-sm text-muted-foreground">Só o responsável por um menor de 18 anos, ou quem recebeu a permissão "Pode me ajudar a preencher meu perfil", pode editar.</p>
        <Link to="/familia" className="mt-4 inline-flex min-h-11 items-center rounded-lg border px-4 font-medium">Voltar para Minha família</Link>
      </div>
    </AppShell>
  );
  const { name, profile } = q.data;
  return (
    <AppShell>
      <p role="status" className="mx-auto mb-6 max-w-2xl rounded-2xl bg-warning-soft p-4 text-lg">Você está preenchendo o perfil de <strong>{name}</strong>. Cada resposta aparece para {name} como "Preenchido por você" e pode ser desfeita.</p>
      <GuidedProfile profile={profile ?? { ...emptyProfile, full_name: name }} whose={name.split(" ")[0] || name}
        save={async (patch) => { const r = await save({ data: { memberId, patch } }); if (r.ok) void qc.invalidateQueries({ queryKey: ["family", "member", memberId] }); return r; }}
        onFinish={() => void navigate({ to: "/familia/$memberId", params: { memberId } })} />
    </AppShell>
  );
}
