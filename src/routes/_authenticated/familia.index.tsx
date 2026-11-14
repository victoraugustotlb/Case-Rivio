import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, Clock, Crown, Eye, Loader2, ShieldCheck, UserRound, Users, XCircle } from "lucide-react";
import { AppShell, PageTitle } from "@/components/vita/AppShell";
import { accountQuery } from "@/lib/account-query";
import { familyQuery } from "@/lib/family-query";
import { listPlans } from "@/lib/account.functions";
import { requestFamilyLink, requestMemberAccess, respondFamilyRequest, respondMemberAccess, revokeMemberAccess } from "@/lib/family.functions";
import { GRANT_DURATIONS, type GrantDuration } from "@/lib/family";
import { DOC_KINDS, type DocKind } from "@/lib/vita-data";
import { requireRole } from "@/lib/require-role";

export const Route = createFileRoute("/_authenticated/familia/")({
  beforeLoad: ({ context }) => requireRole("paciente", context),
  head: () => ({
    meta: [
      { title: "Minha família — Anamedis" },
      { name: "description", content: "Conecte titular e dependentes do plano e escolha quem pode ver seu histórico." },
      { property: "og:title", content: "Minha família — Anamedis" },
      { property: "og:description", content: "Família do plano de saúde com acesso somente por consentimento." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(accountQuery),
  component: Familia,
  errorComponent: ({ error }) => <AppShell><p role="alert" className="rounded-lg bg-danger-soft p-4">{(error as Error).message}</p></AppShell>,
  notFoundComponent: () => <AppShell><p>Página não encontrada.</p></AppShell>,
});

const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");
const fmtTime = (d: string) => new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

function Familia() {
  const { data: account } = useSuspenseQuery(accountQuery);
  if (account.type !== "patient_plan") {
    return (
      <AppShell>
        <div className="mx-auto max-w-xl">
          <PageTitle title="Minha família" />
          <div className="rounded-2xl border bg-card p-6">
            <Users className="h-8 w-8 text-primary" aria-hidden />
            <h2 className="mt-3 text-lg font-semibold">A família é criada pelo plano de saúde</h2>
            <p className="mt-2 text-sm text-muted-foreground">Na assinatura individual cada pessoa tem a própria conta. Quando titular e dependentes usam o Anamedis pelo plano oferecido pela operadora, eles podem se conectar aqui — sempre com aprovação do titular e consentimento de cada adulto.</p>
            <Link to="/plano" className="mt-4 inline-flex min-h-11 items-center rounded-lg border px-4 font-medium">Usar meu plano de saúde</Link>
          </div>
        </div>
      </AppShell>
    );
  }
  return <AppShell><PlanFamily /></AppShell>;
}

function PlanFamily() {
  const qc = useQueryClient();
  const fam = useQuery(familyQuery);
  const respondReq = useServerFn(respondFamilyRequest);
  const askAccess = useServerFn(requestMemberAccess);
  const revoke = useServerFn(revokeMemberAccess);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["family"] });
  const act = async (key: string, fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusy(key); setErr("");
    try { const r = await fn(); if (!r.ok) setErr(r.error ?? "Não foi possível concluir."); await refresh(); }
    catch { setErr("Não foi possível concluir. Tente novamente."); }
    setBusy("");
  };
  if (fam.isPending) return <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Carregando família…</p>;
  if (fam.isError || !fam.data) return <p role="alert" className="rounded-lg bg-danger-soft p-4">Não foi possível carregar sua família.</p>;
  const f = fam.data;
  const holder = f.members.find((m) => m.role === "titular");
  const deps = f.members.filter((m) => m.role === "dependente");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageTitle title="Minha família" subtitle={f.planName ? `Plano oferecido por ${f.planName}` : ""} />
      {err && <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm">{err}</p>}

      {(f.incomingRequests.length > 0 || f.accessRequests.length > 0) && (
        <section aria-label="Avisos" className="space-y-3">
          {f.incomingRequests.map((r) => (
            <div key={r.id} className="rounded-2xl border-2 border-warning bg-warning-soft p-4">
              <p className="flex items-center gap-2 font-semibold"><Bell className="h-4 w-4" aria-hidden />{r.name} quer se conectar à sua família</p>
              <p className="mt-1 text-sm">Carteirinha do solicitante: <span className="font-mono">{r.card}</span> · pedido em {fmt(r.createdAt)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Aprovar não libera documentos: adultos continuam decidindo o que mostram.</p>
              <div className="mt-3 flex gap-2">
                <button type="button" disabled={!!busy} onClick={() => act(r.id, () => respondReq({ data: { id: r.id, approve: true } }))} className="min-h-11 rounded-lg bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-50">Aprovar</button>
                <button type="button" disabled={!!busy} onClick={() => act(r.id, () => respondReq({ data: { id: r.id, approve: false } }))} className="min-h-11 rounded-lg border bg-card px-4 font-medium disabled:opacity-50">Recusar</button>
              </div>
            </div>
          ))}
          {f.accessRequests.map((r) => <AccessRequest key={r.id} id={r.id} name={r.name} onDone={refresh} />)}
        </section>
      )}

      {!f.connected ? <NotConnected planId={f.planId} lastRequest={f.lastRequest} myStatus={f.myStatus} /> : (
        <>
          <section>
            <h2 className="mb-3 font-semibold">Titular do plano</h2>
            {holder ? <MemberCard m={holder} busy={busy === holder.id} onAsk={() => act(holder.id, () => askAccess({ data: { memberId: holder.id } }))} /> : <p className="text-sm text-muted-foreground">Titular não encontrado.</p>}
          </section>
          <section>
            <h2 className="mb-3 font-semibold">Dependentes</h2>
            {deps.length === 0 ? <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">Nenhum dependente conectado. Cada dependente conecta-se pela própria conta, com a sua carteirinha de titular.</p> : (
              <div className="grid gap-3 sm:grid-cols-2">{deps.map((m) => <MemberCard key={m.id} m={m} busy={busy === m.id} onAsk={() => act(m.id, () => askAccess({ data: { memberId: m.id } }))} />)}</div>
            )}
          </section>
        </>
      )}

      <section id="privacidade" className="rounded-2xl border bg-card p-5">
        <h2 className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-5 w-5 text-primary" aria-hidden />Conta e privacidade</h2>
        <p className="mt-1 text-sm text-muted-foreground">A família vê apenas nome, papel e idade. Documentos e perfil de saúde só com a sua autorização. A operadora não recebe dados nem a lista de quem vê quem.</p>
        <h3 className="mt-4 text-sm font-semibold">Quem pode ver seu histórico</h3>
        {f.grantsGiven.length === 0 ? <p className="mt-1 text-sm text-muted-foreground">Ninguém da família tem acesso autorizado por você.</p> : (
          <ul className="mt-2 divide-y">
            {f.grantsGiven.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span><strong>{g.name}</strong> · {g.scope === "tudo" ? "Tudo" : g.categories.join(", ")} · {g.expiresAt ? `até ${fmt(g.expiresAt)}` : "sem prazo"}</span>
                <button type="button" disabled={!!busy} onClick={() => act(g.id, () => revoke({ data: { id: g.id } }))} className="min-h-10 rounded-lg border px-3 font-medium disabled:opacity-50">Revogar</button>
              </li>
            ))}
          </ul>
        )}
        <h3 className="mt-4 text-sm font-semibold">Registro de acessos da família</h3>
        {f.accessLog.length === 0 ? <p className="mt-1 text-sm text-muted-foreground">Nenhum familiar abriu seu histórico.</p> : (
          <ul className="mt-2 space-y-1 text-sm">
            {f.accessLog.map((l, i) => <li key={i} className="flex items-center gap-2"><Eye className="h-4 w-4 text-muted-foreground" aria-hidden />{l.name} viu {l.action === "familia_documento" ? "um documento seu" : "seus documentos"} em {fmtTime(l.at)}</li>)}
          </ul>
        )}
      </section>
    </div>
  );
}

type Member = { id: string; name: string; role: "titular" | "dependente"; age: number | null; since: string | null; access: "voce" | "ver" | "pedir" | "aguardando" };
function MemberCard({ m, onAsk, busy }: { m: Member; onAsk: () => void; busy: boolean }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary-soft text-primary"><UserRound className="h-5 w-5" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{m.name} {m.access === "voce" && <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">Você</span>}</p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium text-foreground">{m.role === "titular" ? <Crown className="h-3.5 w-3.5" aria-hidden /> : <Users className="h-3.5 w-3.5" aria-hidden />}{m.role === "titular" ? "Titular" : "Dependente"}</span>
            {m.age !== null ? `${m.age} anos` : "Idade não informada"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Conectado desde {fmt(m.since)}</p>
        </div>
      </div>
      {m.access === "ver" && <Link to="/familia/$memberId" params={{ memberId: m.id }} className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary font-semibold text-primary-foreground"><Eye className="h-4 w-4" aria-hidden />Ver perfil</Link>}
      {m.access === "pedir" && <button type="button" disabled={busy} onClick={onAsk} className="mt-3 flex min-h-11 w-full items-center justify-center rounded-lg border font-medium disabled:opacity-50">Pedir acesso</button>}
      {m.access === "aguardando" && <p className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-lg bg-muted text-sm"><Clock className="h-4 w-4" aria-hidden />Aguardando autorização</p>}
    </div>
  );
}

function AccessRequest({ id, name, onDone }: { id: string; name: string; onDone: () => Promise<unknown> }) {
  const respond = useServerFn(respondMemberAccess);
  const [scope, setScope] = useState<"tudo" | "categorias">("tudo");
  const [cats, setCats] = useState<DocKind[]>([]);
  const [duration, setDuration] = useState<GrantDuration>("30d");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const send = async (approve: boolean) => {
    setBusy(true); setErr("");
    const r = await respond({ data: { id, approve, scope, categories: cats, duration } });
    if (!r.ok) setErr(r.error); else await onDone();
    setBusy(false);
  };
  const chip = (on: boolean) => `min-h-10 rounded-full border px-3 text-sm ${on ? "border-primary bg-primary-soft font-semibold" : "bg-card"}`;
  return (
    <div className="rounded-2xl border-2 border-warning bg-warning-soft p-4">
      <p className="flex items-center gap-2 font-semibold"><Bell className="h-4 w-4" aria-hidden />{name} pediu para ver seu histórico</p>
      <p className="mt-3 text-sm font-medium">O que liberar</p>
      <div className="mt-1 flex flex-wrap gap-2">
        <button type="button" className={chip(scope === "tudo")} onClick={() => setScope("tudo")}>Tudo (inclui perfil de saúde)</button>
        <button type="button" className={chip(scope === "categorias")} onClick={() => setScope("categorias")}>Só algumas categorias</button>
      </div>
      {scope === "categorias" && <div className="mt-2 flex flex-wrap gap-2">{DOC_KINDS.map((k) => <button key={k} type="button" aria-pressed={cats.includes(k)} className={chip(cats.includes(k))} onClick={() => setCats((l) => (l.includes(k) ? l.filter((x) => x !== k) : [...l, k]))}>{k}</button>)}</div>}
      <p className="mt-3 text-sm font-medium">Por quanto tempo</p>
      <div className="mt-1 flex flex-wrap gap-2">{(Object.keys(GRANT_DURATIONS) as GrantDuration[]).map((d) => <button key={d} type="button" className={chip(duration === d)} onClick={() => setDuration(d)}>{GRANT_DURATIONS[d]}</button>)}</div>
      <p className="mt-2 text-xs text-muted-foreground">Acesso somente leitura. Você pode revogar a qualquer momento em Conta e privacidade.</p>
      {err && <p role="alert" className="mt-2 text-sm">{err}</p>}
      <div className="mt-3 flex gap-2">
        <button type="button" disabled={busy} onClick={() => send(true)} className="min-h-11 rounded-lg bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-50">Autorizar</button>
        <button type="button" disabled={busy} onClick={() => send(false)} className="min-h-11 rounded-lg border bg-card px-4 font-medium disabled:opacity-50">Recusar</button>
      </div>
    </div>
  );
}

function NotConnected({ planId, lastRequest, myStatus }: { planId: string | null; lastRequest: { status: string; createdAt: string } | null; myStatus: string | null }) {
  const qc = useQueryClient();
  const fetchPlans = useServerFn(listPlans);
  const link = useServerFn(requestFamilyLink);
  const plans = useQuery({ queryKey: ["insurance-plans"], queryFn: () => fetchPlans() });
  const [plan, setPlan] = useState(planId ?? "");
  const [card, setCard] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const selected = plan || planId || plans.data?.[0]?.id || "";

  if (lastRequest?.status === "pendente") return (
    <div className="rounded-2xl border bg-card p-6"><Clock className="h-7 w-7 text-primary" aria-hidden /><h2 className="mt-2 font-semibold">Pedido enviado ao titular</h2><p className="mt-1 text-sm text-muted-foreground">Enviado em {fmt(lastRequest.createdAt)}. Assim que o titular aprovar, sua família aparece aqui.</p></div>
  );
  return (
    <div className="rounded-2xl border bg-card p-6">
      {lastRequest?.status === "recusado" ? (
        <><XCircle className="h-7 w-7 text-muted-foreground" aria-hidden /><h2 className="mt-2 font-semibold">Pedido recusado</h2><p className="mt-1 text-sm text-muted-foreground">O titular não aprovou o pedido. Confira a carteirinha com ele e tente de novo.</p></>
      ) : (
        <><Users className="h-7 w-7 text-primary" aria-hidden /><h2 className="mt-2 font-semibold">Nenhuma família conectada</h2><p className="mt-1 text-sm text-muted-foreground">Se você é dependente no plano, conecte-se à família do titular. Ele precisa aprovar.</p></>
      )}
      {!planId || myStatus === null ? <Link to="/plano" className="mt-4 inline-flex min-h-11 items-center rounded-lg border px-4 font-medium">Vincular minha carteirinha primeiro</Link> : !open ? (
        <button type="button" onClick={() => setOpen(true)} className="mt-4 min-h-11 rounded-lg bg-primary px-4 font-semibold text-primary-foreground">Conectar à minha família</button>
      ) : (
        <form className="mt-4 space-y-3" onSubmit={async (e) => {
          e.preventDefault(); setBusy(true); setErr("");
          try { const r = await link({ data: { planId: selected, holderCard: card } }); if (!r.ok) setErr(r.error); else await qc.invalidateQueries({ queryKey: ["family"] }); }
          catch { setErr("Não foi possível enviar o pedido."); }
          setBusy(false);
        }}>
          <label className="block text-sm font-medium">Operadora
            <select value={selected} onChange={(e) => setPlan(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border bg-card px-3">{(plans.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          </label>
          <label className="block text-sm font-medium">Número da carteirinha do TITULAR
            <input inputMode="numeric" value={card} onChange={(e) => setCard(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border bg-card px-3" required />
          </label>
          <p className="text-xs text-muted-foreground">O número da carteirinha não dá acesso a ninguém: o titular vê seu nome e sua carteirinha e decide se aprova.</p>
          {err && <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm">{err}</p>}
          <button type="submit" disabled={busy || !card} className="min-h-11 rounded-lg bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-50">{busy ? "Enviando…" : "Enviar pedido ao titular"}</button>
        </form>
      )}
    </div>
  );
}
