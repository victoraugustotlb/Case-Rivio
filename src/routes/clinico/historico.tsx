import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { listProPatients } from "@/lib/pro.functions";
import { ProPage, SearchBox, StatusTag, fmtDT, scopeText, td, th } from "@/components/vita/pro-ui";

export const Route = createFileRoute("/clinico/historico")({
  head: () => ({ meta: [
    { title: "Histórico de pacientes — Anamedis Clínico" }, { name: "description", content: "Pacientes que já tiveram acesso encerrado: nome, ID, estado e datas." },
    { property: "og:title", content: "Histórico de pacientes — Anamedis Clínico" }, { property: "og:description", content: "Acessos encerrados, sem dados de saúde." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: Historico,
});

function Historico() {
  const fn = useServerFn(listProPatients);
  const q = useQuery({ queryKey: ["pro-patients"], queryFn: () => fn() });
  const [s, setS] = useState("");
  const list = (q.data?.history ?? []).filter((a) => `${a.name} ${a.ref}`.toLowerCase().includes(s.toLowerCase()));
  return (
    <ProPage title="Histórico de pacientes" subtitle="Somente nome, ID e datas. Para ver informações, peça um novo acesso." action={<SearchBox value={s} onChange={setS} />}>
      {q.isLoading ? <Loader2 className="h-5 w-5 animate-spin text-primary" aria-label="Carregando" /> : (
        <div className="overflow-x-auto rounded border bg-card">
          <table className="w-full min-w-[760px] text-[13px]">
            <thead><tr><th className={th}>Paciente</th><th className={th}>ID</th><th className={th}>Estado</th><th className={th}>Primeiro acesso</th><th className={th}>Último acesso</th><th className={th}>Estava autorizado</th><th className={th}></th></tr></thead>
            <tbody>
              {list.length === 0 && <tr><td colSpan={7} className={`${td} py-6 text-center text-muted-foreground`}>{s ? "Nenhum paciente encontrado." : "Nenhum acesso encerrado ainda."}</td></tr>}
              {list.map((a) => (
                <tr key={a.patientId}>
                  <td className={`${td} font-medium`}>{a.name}</td><td className={`${td} font-mono text-xs`}>{a.ref}</td><td className={td}><StatusTag s={a.state} /></td>
                  <td className={`${td} text-xs`}>{fmtDT(a.firstAt)}</td><td className={`${td} text-xs`}>{fmtDT(a.lastAt)}</td><td className={td}>{scopeText(a)}{a.upload ? " · envio" : ""}</td>
                  <td className={`${td} text-right`}><Link to="/clinico/pedir" search={{ ref: a.ref }} className="inline-flex h-8 items-center whitespace-nowrap rounded border px-2 text-xs font-semibold text-primary">Pedir novo acesso</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ProPage>
  );
}
