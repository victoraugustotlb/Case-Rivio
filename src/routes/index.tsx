import { createFileRoute, Link } from "@tanstack/react-router";
import { FileUp, Share2, Stethoscope, Watch } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VITA — Seu histórico de saúde em um só lugar" },
      { name: "description", content: "Reúna exames, laudos, receitas e dados de wearables e mostre tudo ao médico com um código temporário." },
      { property: "og:title", content: "VITA — Hub Pessoal de Saúde" },
      { property: "og:description", content: "Todo o seu histórico de saúde, aberto pelo médico com um código." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="flex items-center gap-2 font-display text-2xl font-bold text-primary"><span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-sm text-primary-foreground">V</span> VITA</span>
        <div className="flex gap-2">
          <Link to="/medico" className="hidden min-h-11 items-center gap-2 rounded-lg px-4 font-medium text-primary sm:inline-flex"><Stethoscope className="h-4 w-4" aria-hidden /> Sou profissional</Link>
          <Link to="/entrar" className="inline-flex min-h-11 items-center rounded-lg bg-primary px-5 font-semibold text-primary-foreground">Entrar</Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 pb-16 pt-10">
        <section className="bg-hero rounded-3xl p-8 text-primary-foreground shadow-soft sm:p-14">
          <h1 className="max-w-3xl font-display text-4xl font-bold leading-tight sm:text-5xl">Todo o seu histórico de saúde em um só lugar.</h1>
          <p className="mt-4 max-w-2xl text-lg opacity-90">Envie exames, laudos e receitas antigas, conecte seu relógio e mostre tudo ao médico com um código. Menos exames repetidos.</p>
          <Link to="/entrar" className="mt-8 inline-flex min-h-12 items-center rounded-lg bg-primary-foreground px-6 font-semibold text-primary">Começar agora</Link>
        </section>
        <section className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            { icon: FileUp, t: "Envie seus documentos", d: "A leitura automática identifica tipo, data e resultados. Você confere antes de salvar." },
            { icon: Watch, t: "Conecte wearables", d: "Frequência cardíaca, sono, pressão e glicose junto com os exames." },
            { icon: Share2, t: "Compartilhe com um código", d: "Você escolhe o que o médico vê e por quanto tempo. Encerre quando quiser." },
          ].map(({ icon: Icon, t, d }) => (
            <article key={t} className="rounded-2xl border bg-card p-6"><Icon className="h-6 w-6 text-primary" aria-hidden /><h2 className="mt-4 font-semibold">{t}</h2><p className="mt-1 text-sm text-muted-foreground">{d}</p></article>
          ))}
        </section>
      </main>
    </div>
  );
}
