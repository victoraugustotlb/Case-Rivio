import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { getProAgenda } from "@/lib/pro.functions";
import { ProPage, fmtDT, td, th } from "@/components/vita/pro-ui";

export const Route = createFileRoute("/clinico/agenda")({
  head: () => ({ meta: [
    { title: "Agenda — VITA Clínico" }, { name: "description", content: "Consultas agendadas pelo VITA com você." },
    { property: "og:title", content: "Agenda — VITA Clínico" }, { property: "og:description", content: "Consultas agendadas pelo VITA." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: Agenda,
});

function Agenda() {
  const fn = useServerFn(getProAgenda);
  const q = useQuery({ queryKey: ["pro-agenda"], queryFn: () => fn() });
  return (
    <ProPage title="Agenda" subtitle="Consultas agendadas pelo VITA. Nenhuma confirmação de sistemas externos.">
      {q.isLoading ? <Loader2 className="h-5 w-5 animate-spin text-primary" aria-label="Carregando" /> : !q.data?.hasProvider ? <p className="text-xs text-muted-foreground">Sua conta não tem atendimento cadastrado na busca de consultas.</p> : (
        <div className="overflow-x-auto rounded border bg-card">
          <table className="w-full min-w-[560px] text-[13px]"><thead><tr><th className={th}>Horário</th><th className={th}>Local</th><th className={th}>Modalidade</th><th className={th}>Cobertura</th><th className={th}>Estado</th></tr></thead>
            <tbody>{q.data.items.length === 0 ? <tr><td colSpan={5} className={`${td} text-muted-foreground`}>Nenhuma consulta.</td></tr> : q.data.items.map((a) => (
              <tr key={a.id}><td className={`${td} font-mono text-xs`}>{fmtDT(a.startsAt)}</td><td className={td}>{a.provider}</td><td className={td}>{a.mode === "tele" || a.mode === "telemedicina" ? "Telemedicina" : a.mode}</td><td className={td}>{a.coverage}</td><td className={td}>{a.status}</td></tr>
            ))}</tbody></table>
        </div>
      )}
    </ProPage>
  );
}
