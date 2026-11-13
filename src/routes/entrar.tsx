import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Stethoscope, User } from "lucide-react";

export const Route = createFileRoute("/entrar")({
  head: () => ({
    meta: [
      { title: "Entrar — VITA" },
      { name: "description", content: "Acesse o VITA como paciente ou como profissional de saúde." },
      { property: "og:title", content: "Entrar — VITA" },
      { property: "og:description", content: "Seu histórico de saúde em um só lugar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Entrar,
});

function Entrar() {
  const [perfil, setPerfil] = useState<"paciente" | "medico">("paciente");
  const nav = useNavigate();
  const medico = perfil === "medico";
  return (
    <div className="grid min-h-screen bg-background font-sans text-foreground lg:grid-cols-2">
      <aside className="hidden flex-col justify-between bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-2 font-display text-2xl font-bold text-sidebar-accent-foreground">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-sidebar-primary text-sm text-sidebar-primary-foreground">V</span> VITA
        </div>
        <div>
          <h2 className="font-display text-4xl font-bold leading-tight text-sidebar-accent-foreground">Todo o histórico de saúde em um só lugar.</h2>
          <p className="mt-4 max-w-md text-sidebar-foreground/80">Exames, laudos, consultas antigas e dados de dispositivos — compartilhados com o médico por um código temporário.</p>
        </div>
        <p className="text-xs text-sidebar-foreground/60">Seus dados só são vistos por quem você autorizar.</p>
      </aside>
      <main className="grid place-items-center px-4 py-10">
        <form className="w-full max-w-md" onSubmit={(e) => { e.preventDefault(); nav({ to: medico ? "/medico" : "/" }); }}>
          <h1 className="font-display text-3xl font-bold tracking-tight">Entrar</h1>
          <p className="mt-1 text-muted-foreground">Escolha como você usa o VITA.</p>
          <div role="tablist" aria-label="Tipo de acesso" className="mt-6 grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
            {([["paciente", "Sou paciente", User], ["medico", "Sou profissional", Stethoscope]] as const).map(([k, l, Icon]) => (
              <button key={k} type="button" role="tab" aria-selected={perfil === k} onClick={() => setPerfil(k)}
                className={`flex min-h-11 items-center justify-center gap-2 rounded-lg text-sm font-semibold ${perfil === k ? "bg-card text-primary shadow-soft" : "text-muted-foreground"}`}>
                <Icon className="h-4 w-4" aria-hidden /> {l}
              </button>
            ))}
          </div>
          <div className="mt-6 space-y-4">
            {medico ? (
              <div className="grid grid-cols-[1fr_6rem] gap-3">
                <label className="block"><span className="text-sm font-medium">CRM</span><input required inputMode="numeric" className="mt-1 min-h-11 w-full rounded-lg border bg-card px-3" /></label>
                <label className="block"><span className="text-sm font-medium">UF</span><input required maxLength={2} className="mt-1 min-h-11 w-full rounded-lg border bg-card px-3 uppercase" /></label>
              </div>
            ) : (
              <label className="block"><span className="text-sm font-medium">E-mail ou CPF</span><input required autoComplete="username" className="mt-1 min-h-11 w-full rounded-lg border bg-card px-3" /></label>
            )}
            <label className="block"><span className="text-sm font-medium">Senha</span><input required type="password" autoComplete="current-password" className="mt-1 min-h-11 w-full rounded-lg border bg-card px-3" /></label>
          </div>
          <button type="submit" className="mt-6 min-h-12 w-full rounded-lg bg-primary font-semibold text-primary-foreground">{medico ? "Entrar no VITA Clínico" : "Entrar"}</button>
          <div className="mt-4 flex justify-between text-sm"><a href="#" className="text-primary underline">Esqueci a senha</a><a href="#" className="text-primary underline">Criar conta</a></div>
          <p className="mt-6 rounded-lg bg-warning-soft p-3 text-xs">Demonstração: qualquer dado preenchido entra. As contas reais ainda não estão ativas.</p>
          <Link to="/" className="sr-only">Ir ao início</Link>
        </form>
      </main>
    </div>
  );
}
