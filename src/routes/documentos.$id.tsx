import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, FileImage, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/vita/AppShell";
import { docs } from "@/lib/vita-data";

export const Route = createFileRoute("/documentos/$id")({
  loader: ({ params }) => {
    const doc = docs.find((d) => d.id === params.id);
    if (!doc) throw notFound();
    return doc;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.title ?? "Documento"} — VITA` },
      { name: "description", content: "Original e informações confirmadas do documento." },
      { property: "og:title", content: `${loaderData?.title ?? "Documento"} — VITA` },
      { property: "og:description", content: "Detalhe do documento no VITA." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  notFoundComponent: () => <AppShell><p>Documento não encontrado. <Link to="/documentos" className="text-primary underline">Voltar</Link></p></AppShell>,
  component: Detalhe,
});

function Detalhe() {
  const d = Route.useLoaderData();
  return (
    <AppShell>
      <div className="mx-auto max-w-5xl">
        <Link to="/documentos" className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary"><ArrowLeft className="h-4 w-4" aria-hidden /> Meus documentos</Link>
        <h1 className="font-display text-3xl font-bold tracking-tight">{d.title}</h1>
        <p className="mt-1 text-muted-foreground">{d.kind} · {d.source} · {d.date}</p>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section aria-label="Original" className="grid min-h-80 place-items-center rounded-2xl border bg-muted p-6 text-center text-muted-foreground">
            <div><FileImage className="mx-auto h-10 w-10" aria-hidden /><p className="mt-2 text-sm">Original · {d.origin}</p></div>
          </section>
          <section className="rounded-2xl border bg-card p-6">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">Informações extraídas</h2>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${d.confirmed ? "bg-success-soft text-success" : "bg-warning-soft text-warning"}`}>
                <ShieldCheck className="h-3 w-3" aria-hidden /> {d.confirmed ? "Confirmado por você" : "Aguardando conferência"}
              </span>
            </div>
            <dl className="mt-4 divide-y">
              {d.fields.map((f) => (
                <div key={f.label} className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">{f.label}</dt><dd className="text-right font-medium">{f.value}</dd></div>
              ))}
            </dl>
            <p className="mt-4 text-xs text-muted-foreground">Em caso de dúvida, o original é a referência.</p>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
