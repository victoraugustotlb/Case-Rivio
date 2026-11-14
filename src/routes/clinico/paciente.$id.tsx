import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { openPatientDocument, openPatientHistory } from "@/lib/pro.functions";
import { ClinicalView, type Opened } from "@/components/vita/ClinicalView";

export const Route = createFileRoute("/clinico/paciente/$id")({
  head: () => ({ meta: [
    { title: "Histórico do paciente — VITA Clínico" }, { name: "description", content: "Visão clínica do que o paciente autorizou, durante o acesso ativo." },
    { property: "og:title", content: "Histórico do paciente — VITA Clínico" }, { property: "og:description", content: "Somente leitura, com registro de cada acesso." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }),
  component: Paciente,
});

function Paciente() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const openFn = useServerFn(openPatientHistory);
  const docFn = useServerFn(openPatientDocument);
  const q = useQuery({ queryKey: ["pro-open", id], queryFn: () => openFn({ data: { patientId: id } }), staleTime: Infinity, gcTime: 0, refetchOnWindowFocus: false });
  const openDocument = useCallback((documentId: string) => docFn({ data: { patientId: id, documentId } }), [docFn, id]);
  const back = useCallback(() => nav({ to: "/clinico/pacientes" }), [nav]);
  if (q.isLoading) return <Loader2 className="h-5 w-5 animate-spin text-primary" aria-label="Abrindo histórico" />;
  if (!q.data || q.data.status !== "valido") return (
    <div className="rounded border bg-card p-4">
      <p className="font-semibold">Acesso encerrado ou inexistente</p>
      <p className="mt-1 text-xs text-muted-foreground">O paciente não tem acesso ativo liberado para você.</p>
      <Link to="/clinico/historico" className="mt-3 inline-flex h-8 items-center rounded border px-2 text-xs font-semibold text-primary">Ver histórico de pacientes</Link>
    </div>
  );
  return <div className="-mx-3 -my-4 lg:-mx-6"><ClinicalView embedded opened={q.data as Opened} onClose={back} onEnded={back} openDocument={openDocument} /></div>;
}
