import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { FileText, ScanLine, Search } from "lucide-react";
import { AppShell, PageTitle } from "@/components/vita/AppShell";
import { useSuspenseQuery } from "@tanstack/react-query";
import { type DocKind } from "@/lib/vita-data";
import { documentsQuery } from "@/lib/documents";
import { PendingUploads } from "@/components/vita/PatientInbox";

export const Route = createFileRoute("/_authenticated/documentos/")({
  head: () => ({
    meta: [
      { title: "Meus documentos — Anamedis" },
      { name: "description", content: "Biblioteca de exames, laudos, consultas antigas, receitas e vacinas." },
      { property: "og:title", content: "Meus documentos — Anamedis" },
      { property: "og:description", content: "Todos os seus documentos médicos organizados." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(documentsQuery),
  component: Documentos,
});

const kinds: ("Todos" | DocKind)[] = ["Todos", "Exame", "Laudo", "Consulta", "Receita", "Vacina"];

function Documentos() {
  const [kind, setKind] = useState<(typeof kinds)[number]>("Todos");
  const [q, setQ] = useState("");
  const { data: docs } = useSuspenseQuery(documentsQuery);
  const list = docs.filter((d) => (kind === "Todos" || d.kind === kind) && d.title.toLowerCase().includes(q.toLowerCase()));
  return (
    <AppShell>
      <div className="mx-auto max-w-5xl">
        <PageTitle title="Meus documentos" subtitle={`${docs.length} documentos no seu histórico`}
          action={<Link to="/documentos/adicionar" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 font-semibold text-primary-foreground"><ScanLine className="h-4 w-4" aria-hidden /> Adicionar</Link>} />
        <div className="mb-4"><PendingUploads /></div>
        <label className="flex min-h-11 items-center gap-2 rounded-lg border bg-card px-3">
          <Search className="h-4 w-4 text-muted-foreground" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome" aria-label="Buscar documentos" className="w-full bg-transparent outline-none" />
        </label>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filtrar por tipo">
          {kinds.map((k) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}
              className={`min-h-10 shrink-0 rounded-full border px-4 text-sm font-medium ${kind === k ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}>{k}</button>
          ))}
        </div>
        <ul className="mt-5 grid gap-3 md:grid-cols-2">
          {list.map((d) => (
            <li key={d.id}>
              <Link to="/documentos/$id" params={{ id: d.id }} className="flex items-center gap-3 rounded-2xl border bg-card p-4 hover:border-primary">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary"><FileText className="h-5 w-5" aria-hidden /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{d.title}</p>
                  <p className="truncate text-sm text-muted-foreground">{[d.source, d.doc_date].filter(Boolean).join(" · ") || "Sem data"}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold">{d.kind}</span>
                  {d.uploaded_by_name && <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary">Enviado por {d.uploaded_by_name}</span>}
                  {!d.confirmed && <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-semibold text-warning">Conferir</span>}
                </div>
              </Link>
            </li>
          ))}
          {list.length === 0 && <li className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground md:col-span-2">{docs.length === 0 ? <>Nenhum documento ainda. <Link to="/documentos/adicionar" className="font-medium text-primary underline">Adicione o primeiro exame, laudo ou receita</Link> para montar seu histórico.</> : "Nenhum documento encontrado."}</li>}
        </ul>
      </div>
    </AppShell>
  );
}
