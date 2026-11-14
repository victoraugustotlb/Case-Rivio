import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ShieldCheck, Trash2 } from "lucide-react";
import { AppShell } from "@/components/vita/AppShell";
import { documentQuery } from "@/lib/documents";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/documentos/$id")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(documentQuery(params.id)),
  head: () => ({
    meta: [
      { title: "Documento — Anamedis" },
      { name: "description", content: "Original e informações confirmadas do documento." },
      { property: "og:title", content: "Documento — Anamedis" },
      { property: "og:description", content: "Detalhe do documento no Anamedis." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Detalhe,
});

function Detalhe() {
  const { id } = Route.useParams();
  const { data: d } = useSuspenseQuery(documentQuery(id));
  const qc = useQueryClient();
  const nav = useNavigate();
  if (!d) return <AppShell><p>Documento não encontrado. <Link to="/documentos" className="text-primary underline">Voltar</Link></p></AppShell>;

  const excluir = async () => {
    if (!confirm("Excluir este documento do seu histórico? Essa ação não pode ser desfeita.")) return;
    if (d.file_path) await supabase.storage.from("medical-documents").remove([d.file_path]);
    await supabase.from("documents").delete().eq("id", d.id);
    await qc.invalidateQueries({ queryKey: ["documents"] });
    nav({ to: "/documentos" });
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl">
        <Link to="/documentos" className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary"><ArrowLeft className="h-4 w-4" aria-hidden /> Meus documentos</Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-3xl font-bold tracking-tight">{d.title}</h1>
            <p className="mt-1 text-muted-foreground">{[d.kind, d.source, d.doc_date].filter(Boolean).join(" · ")}</p>
            {d.uploaded_by_name && <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-full bg-primary-soft px-2 py-0.5 text-primary">Enviado por {d.uploaded_by_name}</span>
              <span className="rounded-full bg-muted px-2 py-0.5">Origem: {d.origin}</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-success"><ShieldCheck className="h-3 w-3" aria-hidden />Original preservado</span>
            </div>}
            {d.note && <p className="mt-2 text-sm">Observação do profissional: {d.note}</p>}
          </div>
          <button type="button" onClick={excluir} className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm font-medium hover:bg-danger-soft"><Trash2 className="h-4 w-4" aria-hidden /> Excluir</button>
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section aria-label="Original" className="overflow-hidden rounded-2xl border bg-muted">
            {d.url ? (d.file_type === "application/pdf"
              ? <iframe src={d.url} title="Original do documento" className="h-[70vh] w-full" />
              : <img src={d.url} alt="Original do documento" className="max-h-[70vh] w-full object-contain" />)
              : <p className="p-8 text-center text-sm text-muted-foreground">Original indisponível.</p>}
          </section>
          <section className="rounded-2xl border bg-card p-6">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">Informações extraídas</h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success"><ShieldCheck className="h-3 w-3" aria-hidden /> {d.uploaded_by_name ? "Conferido pelo profissional" : "Conferido por você"}</span>
            </div>
            {d.summary && <p className="mt-3 text-sm">{d.summary}</p>}
            <dl className="mt-4 divide-y">
              {d.fields.map((f, i) => (
                <div key={i} className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">{f.label}</dt><dd className="text-right font-medium">{f.value}</dd></div>
              ))}
            </dl>
            <p className="mt-4 text-xs text-muted-foreground">Em caso de dúvida, o original é a referência.</p>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
