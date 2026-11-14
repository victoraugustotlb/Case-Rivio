import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listMyUploads, listProPatients, listSentRequests } from "@/lib/pro.functions";
import { Countdown, ProPage, StatusTag, fmtDT, scopeText, td, th } from "@/components/vita/pro-ui";

export const Route = createFileRoute("/clinico/")({
  head: () => ({ meta: [
    { title: "Painel — Anamedis Clínico" }, { name: "description", content: "Resumo dos acessos ativos, solicitações e documentos enviados." },
    { property: "og:title", content: "Painel — Anamedis Clínico" }, { property: "og:description", content: "Acessos ativos e solicitações em um só lugar." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: Painel,
});

function Painel() {
  const p = useServerFn(listProPatients), r = useServerFn(listSentRequests), u = useServerFn(listMyUploads);
  const pats = useQuery({ queryKey: ["pro-patients"], queryFn: () => p(), refetchInterval: 30_000 });
  const reqs = useQuery({ queryKey: ["pro-requests"], queryFn: () => r(), refetchInterval: 15_000 });
  const ups = useQuery({ queryKey: ["pro-uploads"], queryFn: () => u() });
  const active = pats.data?.active ?? [];
  const stats = [
    ["Acessos ativos", active.length], ["Solicitações pendentes", (reqs.data ?? []).filter((x) => x.status === "pending").length],
    ["Envios aguardando paciente", (ups.data ?? []).filter((x) => x.status === "pending_patient").length], ["Pacientes no histórico", pats.data?.history.length ?? 0],
  ] as const;
  return (
    <ProPage title="Painel" subtitle="Somente o que os pacientes liberaram para você." action={<Link to="/clinico/pedir" className="inline-flex h-9 items-center rounded bg-primary px-3 font-semibold text-primary-foreground">Pedir acesso</Link>}>
      <dl className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {stats.map(([l, v]) => <div key={l} className="rounded border bg-card px-3 py-2"><dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{l}</dt><dd className="font-mono text-xl font-semibold tabular-nums">{v}</dd></div>)}
      </dl>
      <section className="overflow-x-auto rounded border bg-card">
        <h2 className="border-b px-2 py-1.5 text-xs font-semibold">Acessos ativos</h2>
        <table className="w-full min-w-[560px] text-[13px]"><thead><tr><th className={th}>Paciente</th><th className={th}>Escopo</th><th className={th}>Restante</th><th className={th}></th></tr></thead>
          <tbody>{active.length === 0 ? <tr><td colSpan={4} className={`${td} text-muted-foreground`}>Nenhum acesso ativo.</td></tr> : active.slice(0, 8).map((a) => (
            <tr key={a.patientId}><td className={td}><span className="font-medium">{a.name}</span> <span className="font-mono text-xs text-muted-foreground">{a.ref}</span></td><td className={td}>{scopeText(a)}</td><td className={td}><Countdown until={a.expiresAt} /></td>
              <td className={`${td} text-right`}><Link to="/clinico/paciente/$id" params={{ id: a.patientId }} className="font-semibold text-primary">Abrir histórico</Link></td></tr>
          ))}</tbody></table>
      </section>
      <section className="overflow-x-auto rounded border bg-card">
        <h2 className="border-b px-2 py-1.5 text-xs font-semibold">Últimas solicitações</h2>
        <table className="w-full min-w-[480px] text-[13px]"><tbody>{(reqs.data ?? []).slice(0, 5).map((x) => (
          <tr key={x.id}><td className={td}>{x.patient}</td><td className={td}>{fmtDT(x.createdAt)}</td><td className={td}><StatusTag s={x.status} /></td></tr>
        ))}{(reqs.data ?? []).length === 0 && <tr><td className={`${td} text-muted-foreground`}>Nenhuma solicitação.</td></tr>}</tbody></table>
      </section>
    </ProPage>
  );
}
