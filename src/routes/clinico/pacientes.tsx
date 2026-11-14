import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { listProPatients } from "@/lib/pro.functions";
import { Countdown, ProPage, SearchBox, fmtDT, scopeText, td, th } from "@/components/vita/pro-ui";

export const Route = createFileRoute("/clinico/pacientes")({
  head: () => ({ meta: [
    { title: "Pacientes com acesso — Anamedis Clínico" }, { name: "description", content: "Pacientes com acesso ativo, escopo autorizado e tempo restante." },
    { property: "og:title", content: "Pacientes com acesso — Anamedis Clínico" }, { property: "og:description", content: "Acessos ativos liberados pelos pacientes." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: Pacientes,
});

function Pacientes() {
  const fn = useServerFn(listProPatients);
  const q = useQuery({ queryKey: ["pro-patients"], queryFn: () => fn(), refetchInterval: 30_000 });
  const [s, setS] = useState("");
  const list = (q.data?.active ?? []).filter((a) => `${a.name} ${a.ref}`.toLowerCase().includes(s.toLowerCase()));
  return (
    <ProPage title="Pacientes com acesso" subtitle="Acesso ativo agora. Ao terminar o tempo, o paciente passa para o histórico." action={<SearchBox value={s} onChange={setS} />}>
      {q.isLoading ? <Loader2 className="h-5 w-5 animate-spin text-primary" aria-label="Carregando" /> : (
        <div className="overflow-x-auto rounded border bg-card">
          <table className="w-full min-w-[760px] text-[13px]">
            <thead><tr><th className={th}>Paciente</th><th className={th}>ID</th><th className={th}>Autorizado</th><th className={th}>Envio</th><th className={th}>Restante</th><th className={th}>Último acesso</th><th className={th}></th></tr></thead>
            <tbody>
              {list.length === 0 && <tr><td colSpan={7} className={`${td} py-6 text-center text-muted-foreground`}>{s ? "Nenhum paciente encontrado." : "Nenhum paciente com acesso ativo."}</td></tr>}
              {list.map((a) => (
                <tr key={a.patientId}>
                  <td className={`${td} font-medium`}>{a.name}</td><td className={`${td} font-mono text-xs`}>{a.ref}</td><td className={td}>{scopeText(a)}</td>
                  <td className={td}>{a.canUpload ? "Permitido" : "—"}</td><td className={td}><Countdown until={a.expiresAt} /></td><td className={`${td} text-xs`}>{fmtDT(a.lastAccess)}</td>
                  <td className={`${td} text-right`}><Link to="/clinico/paciente/$id" params={{ id: a.patientId }} className="inline-flex h-8 items-center rounded bg-primary px-2 text-xs font-semibold text-primary-foreground">Abrir histórico</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ProPage>
  );
}
