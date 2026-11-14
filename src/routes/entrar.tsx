import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Stethoscope, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

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

const G = () => (
  <svg aria-hidden="true" width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
);

function Entrar() {
  const [perfil, setPerfil] = useState<"paciente" | "medico">("paciente");
  const [modo, setModo] = useState<"entrar" | "criar">("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [msg, setMsg] = useState<{ tipo: "erro" | "ok"; texto: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const medico = perfil === "medico";
  useEffect(() => {
    const go = () => nav({ to: "/inicio", replace: true });
    supabase.auth.getSession().then(({ data }) => { if (data.session) go(); });
    const { data } = supabase.auth.onAuthStateChange((e, s) => { if (s && (e === "SIGNED_IN" || e === "INITIAL_SESSION")) go(); });
    return () => data.subscription.unsubscribe();
  }, [nav]);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null); setBusy(true);
    try {
      if (modo === "criar") {
        const { error } = await supabase.auth.signUp({ email, password: senha, options: { emailRedirectTo: window.location.origin, data: { full_name: nome } } });
        if (error) throw error;
        setMsg({ tipo: "ok", texto: "Conta criada. Enviamos um e-mail de confirmação — clique no link para entrar." });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
        nav({ to: "/inicio" });
      }
    } catch (err) {
      const m = err instanceof Error ? err.message : "";
      setMsg({ tipo: "erro", texto: /Invalid login/i.test(m) ? "E-mail ou senha incorretos." : /confirm/i.test(m) ? "Confirme seu e-mail antes de entrar." : /registered/i.test(m) ? "Este e-mail já tem conta. Entre com sua senha." : m || "Não foi possível continuar." });
    } finally { setBusy(false); }
  };

  const google = async () => {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) { setMsg({ tipo: "erro", texto: "Não foi possível entrar com o Google." }); return; }
    if (r.redirected) return;
    nav({ to: "/inicio" });
  };

  const input = "mt-1 min-h-11 w-full rounded-lg border bg-card px-3";
  return (
    <div className="grid min-h-screen bg-background font-sans text-foreground lg:grid-cols-2">
      <aside className="hidden flex-col justify-between bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <Link to="/" className="flex items-center gap-2 font-display text-2xl font-bold text-sidebar-accent-foreground">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-sidebar-primary text-sm text-sidebar-primary-foreground">V</span> VITA
        </Link>
        <div>
          <h2 className="font-display text-4xl font-bold leading-tight text-sidebar-accent-foreground">Todo o histórico de saúde em um só lugar.</h2>
          <p className="mt-4 max-w-md text-sidebar-foreground/80">Exames, laudos, consultas antigas e dados de dispositivos — compartilhados com o médico por um código temporário.</p>
        </div>
        <p className="text-xs text-sidebar-foreground/60">Seus dados só são vistos por quem você autorizar.</p>
      </aside>
      <main className="grid place-items-center px-4 py-10">
        <div className="w-full max-w-md">
          <h1 className="font-display text-3xl font-bold tracking-tight">{modo === "criar" && !medico ? "Criar conta" : "Entrar"}</h1>
          <p className="mt-1 text-muted-foreground">Escolha como você usa o VITA.</p>
          <div role="tablist" aria-label="Tipo de acesso" className="mt-6 grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
            {([["paciente", "Sou paciente", User], ["medico", "Sou profissional", Stethoscope]] as const).map(([k, l, Icon]) => (
              <button key={k} type="button" role="tab" aria-selected={perfil === k} onClick={() => { setPerfil(k); setMsg(null); }}
                className={`flex min-h-11 items-center justify-center gap-2 rounded-lg text-sm font-semibold ${perfil === k ? "bg-card text-primary shadow-soft" : "text-muted-foreground"}`}>
                <Icon className="h-4 w-4" aria-hidden /> {l}
              </button>
            ))}
          </div>

          {medico ? (
            <div className="mt-6 rounded-2xl border bg-card p-5">
              <p className="font-semibold">Acesso por código do paciente</p>
              <p className="mt-1 text-sm text-muted-foreground">Peça ao paciente o código de 8 caracteres gerado no app dele. Você verá apenas o que ele autorizou, pelo tempo escolhido.</p>
              <Link to="/medico" className="mt-4 flex min-h-12 items-center justify-center rounded-lg bg-primary font-semibold text-primary-foreground">Abrir VITA Clínico</Link>
              <p className="mt-3 text-xs text-muted-foreground">Contas profissionais com validação de CRM ainda não estão disponíveis.</p>
            </div>
          ) : (
            <>
              <button type="button" onClick={google} className="mt-6 flex min-h-11 w-full items-center justify-center gap-[10px] rounded-lg border border-[#747775] bg-[#FFFFFF] px-3 text-sm font-medium text-[#1F1F1F]">
                <G /> Continuar com o Google
              </button>
              <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />ou com e-mail<span className="h-px flex-1 bg-border" /></div>
              <form className="space-y-4" onSubmit={enviar}>
                {modo === "criar" && <label className="block"><span className="text-sm font-medium">Nome</span><input required value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" className={input} /></label>}
                <label className="block"><span className="text-sm font-medium">E-mail</span><input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className={input} /></label>
                <label className="block"><span className="text-sm font-medium">Senha</span><input required minLength={6} type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete={modo === "criar" ? "new-password" : "current-password"} className={input} /></label>
                {msg && <p role={msg.tipo === "erro" ? "alert" : "status"} className={`rounded-lg p-3 text-sm ${msg.tipo === "erro" ? "bg-danger-soft" : "bg-success-soft"}`}>{msg.texto}</p>}
                <button type="submit" disabled={busy} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary font-semibold text-primary-foreground disabled:opacity-60">
                  {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}{modo === "criar" ? "Criar conta" : "Entrar"}
                </button>
              </form>
              <p className="mt-4 text-center text-sm">
                {modo === "entrar" ? <>Ainda não tem conta? <button type="button" onClick={() => { setModo("criar"); setMsg(null); }} className="font-medium text-primary underline">Criar conta</button></>
                  : <>Já tem conta? <button type="button" onClick={() => { setModo("entrar"); setMsg(null); }} className="font-medium text-primary underline">Entrar</button></>}
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
