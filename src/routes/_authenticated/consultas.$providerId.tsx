import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { z } from "zod";
import { AlertTriangle, ArrowLeft, CalendarCheck, MapPin, Share2, Video } from "lucide-react";
import { AppShell, PageTitle } from "@/components/vita/AppShell";
import { DemoTag, PlanBadge, Seg, TeleTag, brl, dayKeyLabel, fmtFull, fmtTime, kindLabel } from "@/components/vita/scheduling-ui";
import { bookAppointment, getProviderDetail, rescheduleAppointment } from "@/lib/scheduling.functions";
import { dayKey, openSlots, type Mode } from "@/lib/scheduling";

const detailQuery = (id: string) => queryOptions({ queryKey: ["provider", id], queryFn: () => getProviderDetail({ data: { id } }) });

export const Route = createFileRoute("/_authenticated/consultas/$providerId")({
  validateSearch: (s: Record<string, unknown>) => z.object({ remarcar: z.string().uuid().optional(), horario: z.string().uuid().optional() }).catch({}).parse(s),
  head: () => ({
    meta: [
      { title: "Horários e agendamento — VITA" },
      { name: "description", content: "Veja convênios aceitos, preço particular e horários livres para agendar." },
      { property: "og:title", content: "Horários e agendamento — VITA" },
      { property: "og:description", content: "Escolha um horário e confirme o agendamento." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(detailQuery(params.providerId)),
  component: Detalhe,
});

function Detalhe() {
  const { providerId } = Route.useParams();
  const { remarcar, horario } = Route.useSearch();
  const { data } = useSuspenseQuery(detailQuery(providerId));
  const qc = useQueryClient();
  const book = useServerFn(bookAppointment);
  const resched = useServerFn(rescheduleAppointment);
  const [slotId, setSlotId] = useState<string | null>(horario ?? null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [share, setShare] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ id: string; endsAt: string } | null>(null);

  const days = useMemo(() => {
    const m = new Map<string, NonNullable<typeof data>["slots"]>();
    for (const s of openSlots(data?.slots ?? [], new Date())) { const k = dayKey(s.starts_at); m.set(k, [...(m.get(k) ?? []), s]); }
    return [...m.entries()].slice(0, 14);
  }, [data]);

  if (!data) return <AppShell><p>Profissional não encontrado. <Link to="/consultas" className="text-primary underline">Voltar à busca</Link></p></AppShell>;
  const { provider: p, planNames, plan, acceptsMyPlan } = data;
  const slot = data.slots.find((s) => s.id === slotId && !s.booked) ?? null;
  const modes: Mode[] = [...(p.in_person ? ["presencial" as const] : []), ...(p.telehealth ? ["telemedicina" as const] : [])];
  const chosenMode = mode ?? (modes.length === 1 ? modes[0]! : null);

  if (done) {
    return (
      <AppShell>
        <div className="mx-auto max-w-xl rounded-2xl border bg-card p-8 text-center">
          <CalendarCheck className="mx-auto h-12 w-12 text-success" aria-hidden />
          <h1 className="mt-3 font-display text-2xl font-bold">{remarcar ? "Remarcado pelo VITA" : "Agendado pelo VITA"}</h1>
          <p className="mt-2 text-muted-foreground">{p.name} · {slot ? fmtFull(slot.starts_at) : ""}</p>
          {p.is_demo && <p className="mt-3 text-sm"><DemoTag /> Este profissional é fictício: nenhum consultório real foi avisado.</p>}
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {share && <Link to="/compartilhar" search={{ consulta: done.id, ate: done.endsAt }} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 font-semibold text-primary-foreground"><Share2 className="h-4 w-4" aria-hidden />Escolher o que compartilhar</Link>}
            <Link to="/consultas/agendamentos" className="inline-flex min-h-11 items-center rounded-lg border px-4 font-medium">Meus agendamentos</Link>
          </div>
        </div>
      </AppShell>
    );
  }

  const confirm = async () => {
    if (!slot || !chosenMode) return;
    setBusy(true); setError("");
    const r = remarcar ? await resched({ data: { id: remarcar, slotId: slot.id } }) : await book({ data: { slotId: slot.id, mode: chosenMode } });
    setBusy(false);
    await qc.invalidateQueries({ queryKey: ["appointments"] });
    if (!r.ok) { setError(r.error); await qc.invalidateQueries({ queryKey: ["provider", providerId] }); setSlotId(null); return; }
    setDone({ id: r.id, endsAt: new Date(new Date(slot.starts_at).getTime() + slot.duration_min * 60_000).toISOString() });
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl">
        <Link to="/consultas" className="mb-3 inline-flex min-h-10 items-center gap-1 text-sm font-medium text-primary"><ArrowLeft className="h-4 w-4" aria-hidden />Voltar à busca</Link>
        <PageTitle title={p.name} subtitle={`${kindLabel[p.kind]} · ${p.specialties.join(", ")}`} action={p.is_demo ? <DemoTag /> : undefined} />
        {remarcar && <p role="status" className="mb-4 rounded-lg bg-warning-soft p-3 text-sm">Remarcando: escolha o novo horário. O horário anterior será liberado.</p>}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6">
            <section className="rounded-2xl border bg-card p-5">
              <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />{p.address}, {p.city}/{p.uf}</p>
              <div className="mt-3 flex flex-wrap gap-2"><PlanBadge accepts={acceptsMyPlan} planName={plan?.name ?? null} price={p.price_private} />{p.telehealth && <TeleTag />}</div>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div><dt className="text-muted-foreground">Convênios aceitos</dt><dd className="font-medium">{planNames.length ? planNames.join(", ") : "Somente particular"}</dd></div>
                <div><dt className="text-muted-foreground">Preço particular (informativo)</dt><dd className="font-medium">{brl(p.price_private)}</dd></div>
              </dl>
              <p className="mt-3 text-xs text-muted-foreground">Não há pagamento pelo VITA. O valor é pago diretamente ao profissional, se for particular.</p>
            </section>
            <section className="rounded-2xl border bg-card p-5">
              <h2 className="font-semibold">Horários disponíveis</h2>
              {days.length === 0 && <p className="mt-2 text-sm text-muted-foreground">Sem horários livres no momento.</p>}
              <div className="mt-3 space-y-4">
                {days.map(([k, slots]) => (
                  <div key={k}>
                    <h3 className="text-sm font-medium first-letter:uppercase text-muted-foreground">{dayKeyLabel(slots[0]!.starts_at)}</h3>
                    <div className="mt-2 flex flex-wrap gap-2">{slots.map((s) => (
                      <button key={s.id} type="button" aria-pressed={slotId === s.id} onClick={() => { setSlotId(s.id); setError(""); }}
                        className={`min-h-10 rounded-lg border px-3 text-sm font-medium ${slotId === s.id ? "border-primary bg-primary text-primary-foreground" : "border-primary/40 text-primary hover:bg-primary-soft"}`}>{fmtTime(s.starts_at)}</button>
                    ))}</div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside aria-label="Resumo do agendamento" className="space-y-4 rounded-2xl border bg-card p-5 lg:sticky lg:top-24 lg:self-start">
            <h2 className="font-semibold">Resumo</h2>
            {!slot ? <p className="text-sm text-muted-foreground">Escolha um horário para ver o resumo.</p> : (
              <>
                <dl className="space-y-2 text-sm">
                  <div><dt className="text-muted-foreground">Quem</dt><dd className="font-medium">{p.name}</dd></div>
                  <div><dt className="text-muted-foreground">Quando</dt><dd className="font-medium first-letter:uppercase">{fmtFull(slot.starts_at)} ({slot.duration_min} min)</dd></div>
                  {!remarcar && modes.length > 1 && <div><dt className="mb-1 text-muted-foreground">Como</dt><dd><Seg label="Tipo de atendimento" value={(mode ?? "") as Mode} onChange={setMode} options={[{ v: "presencial", l: "Presencial" }, { v: "telemedicina", l: "Telemedicina" }]} /></dd></div>}
                  <div><dt className="text-muted-foreground">Onde</dt><dd className="font-medium">{chosenMode === "telemedicina" ? <span className="inline-flex items-center gap-1"><Video className="h-4 w-4" aria-hidden />Por vídeo. O link de acesso é enviado pelo profissional.</span> : chosenMode === "presencial" ? `${p.address}, ${p.city}/${p.uf}` : "Escolha presencial ou telemedicina"}</dd></div>
                  <div><dt className="text-muted-foreground">Pagamento</dt><dd className="font-medium">{acceptsMyPlan && plan ? `Convênio: ${plan.name}` : `Particular: ${brl(p.price_private)}`}</dd></div>
                </dl>
                {!acceptsMyPlan && plan && <p role="alert" className="flex gap-2 rounded-lg bg-warning-soft p-3 text-sm"><AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />Este profissional não aceita {plan.name}. A consulta será particular ({brl(p.price_private)}), paga diretamente a ele.</p>}
                {!remarcar && (
                  <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
                    <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" />
                    <span>Compartilhar meu histórico com este profissional antes da consulta<span className="block text-xs text-muted-foreground">Você escolhe o que mostrar na próxima tela; o código vale até o fim da consulta.</span></span>
                  </label>
                )}
                {error && <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm">{error}</p>}
                <button type="button" disabled={busy || !chosenMode} onClick={confirm} className="min-h-12 w-full rounded-lg bg-primary font-semibold text-primary-foreground disabled:opacity-50">{busy ? "Confirmando…" : remarcar ? "Confirmar novo horário" : "Confirmar agendamento"}</button>
              </>
            )}
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

