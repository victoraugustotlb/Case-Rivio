import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText, FileUp, Loader2, Lock, Share2 } from "lucide-react";
import { AppShell, PageTitle } from "@/components/vita/AppShell";
import { memberRecordsQuery } from "@/lib/family-query";
import { openMemberDocument } from "@/lib/family.functions";
import { requireRole } from "@/lib/require-role";

export const Route = createFileRoute("/_authenticated/familia/$memberId")({
  beforeLoad: ({ context }) => requireRole("paciente", context),
  head: () => ({
    meta: [
      { title: "Perfil de familiar — Anamedis" },
      { name: "description", content: "Histórico de um familiar, aberto com autorização e somente para leitura." },
      { property: "og:title", content: "Perfil de familiar — Anamedis" },
      { property: "og:description", content: "Acesso familiar somente leitura, registrado para o dono do histórico." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Membro,
  errorComponent: ({ error }) => <AppShell><p role="alert" className="rounded-lg bg-danger-soft p-4">{(error as Error).message}</p></AppShell>,
  notFoundComponent: () => <AppShell><p>Perfil não encontrado.</p></AppShell>,
});

const reasons: Record<string, string> = {
  sem_consentimento: "Esta pessoa ainda não autorizou você a ver o histórico dela.",
  pendente: "Seu pedido de acesso está aguardando autorização.",
  expirado: "A autorização terminou. Peça acesso de novo em Minha família.",
  revogado: "A autorização foi revogada pela pessoa.",
  outra_familia: "Esta pessoa não faz parte da sua família no plano.",
  proprio: "Este é o seu próprio perfil.",
};

function Membro() {
  const { memberId } = Route.useParams();
  const q = useQuery(memberRecordsQuery(memberId));
  const open = useServerFn(openMemberDocument);
  const [opening, setOpening] = useState("");
  const [err, setErr] = useState("");
  if (q.isPending) return <AppShell><p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Carregando…</p></AppShell>;
  if (q.isError || !q.data) return <AppShell><p role="alert" className="rounded-lg bg-danger-soft p-4">Não foi possível abrir este perfil.</p></AppShell>;
  const r = q.data;
  if (!r.allowed) return (
    <AppShell>
      <div className="mx-auto max-w-xl rounded-2xl border bg-card p-6">
        <Lock className="h-7 w-7 text-muted-foreground" aria-hidden />
        <h1 className="mt-2 text-lg font-semibold">{r.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{reasons[r.reason] ?? "Acesso não autorizado."}</p>
        <Link to="/familia" className="mt-4 inline-flex min-h-11 items-center rounded-lg border px-4 font-medium">Voltar para Minha família</Link>
      </div>
    </AppShell>
  );
  const p = r.profile;
  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-6">
        <PageTitle title={r.name} subtitle={`${r.age !== null ? `${r.age} anos · ` : ""}${r.basis === "responsavel_legal" ? "Você é o responsável legal" : r.scope === "tudo" ? "Acesso autorizado: tudo" : `Acesso autorizado: ${r.categories.join(", ")}`}`}
          action={r.basis === "responsavel_legal" ? (
            <div className="flex flex-wrap gap-2">
              <Link to="/documentos/adicionar" search={{ para: memberId }} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 font-semibold text-primary-foreground"><FileUp className="h-4 w-4" aria-hidden />Adicionar documento</Link>
              <Link to="/compartilhar" search={{ para: memberId }} className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 font-medium"><Share2 className="h-4 w-4" aria-hidden />Gerar código para médico</Link>
            </div>
          ) : undefined} />
        {err && <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm">{err}</p>}
        {r.canEditProfile && <Link to="/familia/$memberId/perfil" params={{ memberId }} className="inline-flex min-h-12 items-center rounded-lg bg-primary px-5 font-semibold text-primary-foreground">Ajudar a preencher o perfil</Link>}
        {r.scope === "tudo" && (
          <section className="rounded-2xl border bg-card p-5">
            <h2 className="font-semibold">Perfil de saúde</h2>
            {!p ? <p className="mt-1 text-sm text-muted-foreground">Questionário ainda não preenchido.</p> : (
              <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                {[["Altura", p.height_cm ? `${p.height_cm} cm` : ""], ["Peso", p.weight_kg ? `${p.weight_kg} kg` : ""], ["Alergias", p.allergies], ["Condições", p.conditions], ["Cirurgias", p.surgeries], ["Histórico familiar", p.family_history],
                  ["Medicamentos", p.medications.map((m) => [m.name, m.dose, m.frequency].filter(Boolean).join(" · ")).join("; ")]].map(([k, v]) => (
                  <div key={k}><dt className="text-muted-foreground">{k}</dt><dd className="font-medium">{v || "Não informado"}</dd></div>
                ))}
              </dl>
            )}
          </section>
        )}
        <section>
          <h2 className="mb-3 font-semibold">Documentos ({r.documents.length})</h2>
          {r.documents.length === 0 ? <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">Nenhum documento disponível.</p> : (
            <ul className="space-y-2">
              {r.documents.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
                  <FileText className="h-5 w-5 text-primary" aria-hidden />
                  <div className="min-w-0 flex-1"><p className="truncate font-medium">{d.title}</p><p className="text-sm text-muted-foreground">{d.kind} · {d.doc_date || "sem data"}{d.source ? ` · ${d.source}` : ""}</p></div>
                  <button type="button" disabled={opening === d.id} onClick={async () => {
                    setOpening(d.id); setErr("");
                    const res = await open({ data: { memberId, documentId: d.id } });
                    setOpening("");
                    if (res.ok && res.url) window.open(res.url, "_blank", "noopener"); else setErr(res.ok ? "Arquivo indisponível." : res.error);
                  }} className="min-h-10 rounded-lg border px-3 text-sm font-medium disabled:opacity-50">Abrir original</button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <p className="text-xs text-muted-foreground">Somente leitura. {r.name} vê no registro de acessos quando você abre este histórico.</p>
      </div>
    </AppShell>
  );
}
