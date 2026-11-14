import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Bell, CalendarPlus, MapPin, Share2, Video } from "lucide-react";
import { AppShell, PageTitle } from "@/components/vita/AppShell";
import { DemoTag, fmtFull } from "@/components/vita/scheduling-ui";
import { appointmentsQuery } from "@/lib/scheduling-query";
import { cancelAppointment } from "@/lib/scheduling.functions";
import { canChange, isTomorrow } from "@/lib/scheduling";

export const Route = createFileRoute("/_authenticated/consultas/agendamentos")({
  head: () => ({
    meta: [
      { title: "Meus agendamentos — VITA" },
      { name: "description", content: "Consultas agendadas pelo VITA: próximas e anteriores, cancelar ou remarcar." },
      { property: "og:title", content: "Meus agendamentos — VITA" },
      { property: "og:description", content: "Acompanhe, cancele ou remarque suas consultas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(appointmentsQuery),
  component: Agendamentos,
});

const statusLabel: Record<string, string> = { agendado: "Agendado pelo VITA", cancelado: "Cancelado", remarcado: "Remarcado" };

function Agendamentos() {
  const { data } = useSuspenseQuery(appointmentsQuery);
  const qc = useQueryClient();
  const cancel = useServerFn(cancelAppointment);
  const [msg, setMsg] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);
  const now = Date.now();
  const upcoming = data.filter((a) => a.status === "agendado" && new Date(a.startsAt).getTime() > now).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const past = data.filter((a) => !upcoming.includes(a) && a.status !== "remarcado").sort((a, b) => b.startsAt.localeCompare(a.startsAt));

  const doCancel = async (id: string) => {
    const r = await cancel({ data: { id } });
    setConfirming(null);
    setMsg(r.ok ? "Consulta cancelada. O horário foi liberado." : r.error);
    await qc.invalidateQueries({ queryKey: ["appointments"] });
  };

  const Card = ({ a, future }: { a: (typeof data)[number]; future: boolean }) => {
    const changeable = future && canChange(a.startsAt);
    const end = new Date(new Date(a.startsAt).getTime() + a.durationMin * 60_000).toISOString();
    return (
      <li className="rounded-2xl border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0"><p className="font-semibold">{a.provider.name}</p><p className="text-sm text-muted-foreground">{a.provider.specialties.join(", ")}</p></div>
          <div className="flex flex-wrap gap-2">{a.provider.is_demo && <DemoTag />}<span className={`rounded-full px-2 py-0.5 text-xs font-medium ${a.status === "agendado" ? "bg-success-soft text-success" : "bg-muted"}`}>{statusLabel[a.status]}</span></div>
        </div>
        <p className="mt-2 font-medium first-letter:uppercase">{fmtFull(a.startsAt)}</p>
        {future && isTomorrow(a.startsAt) && <p className="mt-2 flex items-center gap-2 rounded-lg bg-primary-soft p-2 text-sm"><Bell className="h-4 w-4 text-primary" aria-hidden />Lembrete: sua consulta é amanhã.</p>}
        <p className="mt-1 flex items-start gap-1 text-sm">{a.mode === "telemedicina" ? <><Video className="mt-0.5 h-4 w-4" aria-hidden />Telemedicina — o link de acesso é enviado pelo profissional</> : <><MapPin className="mt-0.5 h-4 w-4" aria-hidden />{a.provider.address}, {a.provider.city}/{a.provider.uf}</>}</p>
        <p className="mt-1 text-sm text-muted-foreground">{a.coverage === "plano" ? "Pelo convênio" : "Particular"}{a.shareCodeId ? " · Histórico compartilhado para esta consulta" : ""}</p>
        {future && (
          <div className="mt-4 flex flex-wrap gap-2">
            {changeable ? (
              <>
                <Link to="/consultas/$providerId" params={{ providerId: a.providerId }} search={{ remarcar: a.id }} className="min-h-11 content-center rounded-lg border px-4 text-sm font-medium hover:bg-muted">Remarcar</Link>
                {confirming === a.id ? (
                  <span className="flex flex-wrap items-center gap-2 text-sm">Cancelar esta consulta?
                    <button type="button" onClick={() => doCancel(a.id)} className="min-h-11 rounded-lg bg-destructive px-4 font-semibold text-destructive-foreground">Sim, cancelar</button>
                    <button type="button" onClick={() => setConfirming(null)} className="min-h-11 rounded-lg px-3">Não</button>
                  </span>
                ) : <button type="button" onClick={() => setConfirming(a.id)} className="min-h-11 rounded-lg border border-destructive px-4 text-sm font-medium text-destructive">Cancelar</button>}
              </>
            ) : <p className="text-sm text-muted-foreground">Faltam menos de 2 horas: não é mais possível cancelar ou remarcar pelo app.</p>}
            {!a.shareCodeId && <Link to="/compartilhar" search={{ consulta: a.id, ate: end }} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-primary"><Share2 className="h-4 w-4" aria-hidden />Compartilhar histórico</Link>}
          </div>
        )}
      </li>
    );
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <PageTitle title="Meus agendamentos" action={<Link to="/consultas" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 font-semibold text-primary-foreground"><CalendarPlus className="h-4 w-4" aria-hidden />Agendar</Link>} />
        {msg && <p role="status" className="mb-4 rounded-lg bg-primary-soft p-3 text-sm">{msg}</p>}
        <h2 className="mb-3 font-semibold">Próximos</h2>
        {upcoming.length === 0 ? <p className="mb-8 rounded-2xl border bg-card p-5 text-sm text-muted-foreground">Nenhuma consulta agendada.</p> : <ul className="mb-8 space-y-4">{upcoming.map((a) => <Card key={a.id} a={a} future />)}</ul>}
        <h2 className="mb-3 font-semibold">Anteriores</h2>
        {past.length === 0 ? <p className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">Nada por aqui ainda.</p> : <ul className="space-y-4">{past.map((a) => <Card key={a.id} a={a} future={false} />)}</ul>}
      </div>
    </AppShell>
  );
}
