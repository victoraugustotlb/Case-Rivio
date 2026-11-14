import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Building2, ChevronRight, CreditCard, Loader2, ShieldCheck, Stethoscope } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { INTENT_KEY, useSignedInRedirect, type EntryIntent } from "@/hooks/use-signed-in-redirect";
import { DoctorFields, type DoctorForm } from "@/components/vita/DoctorFields";
import { LabFields, emptyLab, type LabForm } from "@/components/vita/LabFields";
import { formatPrice } from "@/lib/pricing";

export const Route = createFileRoute("/entrar")({
  head: () => ({
    meta: [
      { title: "Entrar — VITA" },
      { name: "description", content: "Entre no VITA pelo plano de saúde, com a assinatura individual ou como profissional de saúde." },
      { property: "og:title", content: "Entrar — VITA" },
      { property: "og:description", content: "Seu histórico de saúde em um só lugar, com o seu controle." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Entrar,
});

type Path = "plano" | "individual" | "profissional";
const G = () => (
  <svg aria-hidden="true" width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
);

const PATHS: { id: Path; title: string; text: string; icon: typeof ShieldCheck }[] = [
  { id: "plano", title: "Entrar com plano de saúde", text: "Plano oferecido pela operadora. Sem cobrança para você.", icon: ShieldCheck },
  { id: "individual", title: "Sem plano: assinatura individual", text: `${formatPrice()} por mês. Mesma segurança e mesmo controle.`, icon: CreditCard },
  { id: "profissional", title: "Sou profissional de saúde", text: "Médicos, laboratórios e clínicas.", icon: Stethoscope },
];

function errorText(err: unknown): string {
  const m = err instanceof Error ? err.message : "";
  return /Invalid login/i.test(m) ? "E-mail ou senha incorretos." : /confirm/i.test(m) ? "Confirme seu e-mail antes de entrar." : /registered/i.test(m) ? "Este e-mail já tem conta. Entre com sua senha." : m || "Não foi possível continuar.";
}

function Entrar() {
  useSignedInRedirect();
  const [path, setPath] = useState<Path | null>(null);
  return (
    <div className="grid min-h-screen bg-background font-sans text-foreground lg:grid-cols-2">
      <aside className="hidden flex-col justify-between bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <Link to="/" className="flex items-center gap-2 font-display text-2xl font-bold text-sidebar-accent-foreground">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-sidebar-primary text-sm text-sidebar-primary-foreground">V</span> VITA
        </Link>
        <div>
          <h2 className="font-display text-4xl font-bold leading-tight text-sidebar-accent-foreground">Todo o histórico de saúde em um só lugar.</h2>
          <p className="mt-4 max-w-md text-sidebar-foreground/80">Pelo plano ou pela assinatura individual, as garantias são as mesmas: só você decide quem vê o seu histórico.</p>
        </div>
        <p className="text-xs text-sidebar-foreground/60">Seus dados só são vistos por quem você autorizar.</p>
      </aside>
      <main className="grid place-items-center px-4 py-10">
        <div className="w-full max-w-md">
          {!path ? (
            <>
              <h1 className="font-display text-3xl font-bold tracking-tight">Como você vai usar o VITA?</h1>
              <p className="mt-1 text-muted-foreground">Escolha um caminho para entrar ou criar sua conta.</p>
              <ul className="mt-6 space-y-3">
                {PATHS.map(({ id, title, text, icon: Icon }) => (
                  <li key={id}>
                    <button type="button" onClick={() => setPath(id)} className="flex min-h-24 w-full items-center gap-4 rounded-2xl border bg-card p-5 text-left shadow-soft transition hover:border-primary hover:bg-primary-soft">
                      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary"><Icon className="h-6 w-6" aria-hidden /></span>
                      <span className="min-w-0 flex-1"><span className="block font-display text-lg font-semibold">{title}</span><span className="text-sm text-muted-foreground">{text}</span></span>
                      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-center text-xs text-muted-foreground">Plano ou assinatura individual: as mesmas garantias de privacidade e o mesmo controle do paciente.</p>
            </>
          ) : (
            <>
              <button type="button" onClick={() => setPath(null)} className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm text-muted-foreground hover:bg-muted"><ArrowLeft className="h-4 w-4" aria-hidden />Outros caminhos</button>
              {path === "profissional" ? <ProfessionalForm /> : <PatientForm path={path} />}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function ModeTabs({ modo, setModo }: { modo: "entrar" | "criar"; setModo: (m: "entrar" | "criar") => void }) {
  return (
    <div role="tablist" aria-label="Acesso" className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
      {([["entrar", "Já tenho conta"], ["criar", "Criar conta"]] as const).map(([k, l]) => (
        <button key={k} type="button" role="tab" aria-selected={modo === k} onClick={() => setModo(k)} className={`min-h-11 rounded-lg text-sm font-semibold ${modo === k ? "bg-card text-primary shadow-soft" : "text-muted-foreground"}`}>{l}</button>
      ))}
    </div>
  );
}

function Message({ msg }: { msg: { tipo: "erro" | "ok"; texto: string } | null }) {
  if (!msg) return null;
  return <p role={msg.tipo === "erro" ? "alert" : "status"} className={`rounded-lg p-3 text-sm ${msg.tipo === "erro" ? "bg-danger-soft" : "bg-success-soft"}`}>{msg.texto}</p>;
}

function PatientForm({ path }: { path: "plano" | "individual" }) {
  const intent: EntryIntent = path === "plano" ? "patient_plan" : "patient_individual";
  const [modo, setModo] = useState<"entrar" | "criar">("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [msg, setMsg] = useState<{ tipo: "erro" | "ok"; texto: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const input = "mt-1 min-h-11 w-full rounded-lg border bg-card px-3";

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg(null); setBusy(true);
    try {
      localStorage.setItem(INTENT_KEY, intent);
      if (modo === "criar") {
        const { error } = await supabase.auth.signUp({ email, password: senha, options: { emailRedirectTo: window.location.origin, data: { full_name: nome, account_type: intent } } });
        if (error) throw error;
        setMsg({ tipo: "ok", texto: "Conta criada. Enviamos um e-mail de confirmação — clique no link para entrar." });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
      }
    } catch (err) { localStorage.removeItem(INTENT_KEY); setMsg({ tipo: "erro", texto: errorText(err) }); } finally { setBusy(false); }
  };
  const google = async () => {
    localStorage.setItem(INTENT_KEY, intent);
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) { localStorage.removeItem(INTENT_KEY); setMsg({ tipo: "erro", texto: "Não foi possível entrar com o Google." }); }
  };

  return (
    <>
      <h1 className="font-display text-3xl font-bold tracking-tight">{path === "plano" ? "Entrar com plano de saúde" : "Assinatura individual"}</h1>
      <p className="mt-1 text-muted-foreground">{path === "plano" ? "Plano oferecido pela operadora. Depois de entrar, você informa a carteirinha. A operadora não recebe acesso ao seu histórico." : `${formatPrice()} por mês. Mesma segurança e mesmo controle do acesso pelo plano.`}</p>
      <ModeTabs modo={modo} setModo={(m) => { setModo(m); setMsg(null); }} />
      <button type="button" onClick={google} className="mt-5 flex min-h-11 w-full items-center justify-center gap-[10px] rounded-lg border border-[#747775] bg-[#FFFFFF] px-3 text-sm font-medium text-[#1F1F1F]">
        <G /> Continuar com o Google
      </button>
      <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />ou com e-mail<span className="h-px flex-1 bg-border" /></div>
      <form className="space-y-4" onSubmit={enviar}>
        {modo === "criar" && <label className="block"><span className="text-sm font-medium">Nome</span><input required value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" className={input} /></label>}
        <label className="block"><span className="text-sm font-medium">E-mail</span><input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className={input} /></label>
        <label className="block"><span className="text-sm font-medium">Senha</span><input required minLength={6} type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete={modo === "criar" ? "new-password" : "current-password"} className={input} /></label>
        <Message msg={msg} />
        <button type="submit" disabled={busy} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary font-semibold text-primary-foreground disabled:opacity-60">
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}{modo === "criar" ? "Criar conta" : "Entrar"}
        </button>
      </form>
    </>
  );
}

function ProfessionalForm() {
  const [kind, setKind] = useState<"doctor" | "laboratory">("doctor");
  const [modo, setModo] = useState<"entrar" | "criar">("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [doc, setDoc] = useState<DoctorForm>({ full_name: "", crm: "", uf: "SP", specialty: "" });
  const [lab, setLab] = useState<LabForm>(emptyLab);
  const [msg, setMsg] = useState<{ tipo: "erro" | "ok"; texto: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const input = "mt-1 min-h-11 w-full rounded-lg border bg-card px-3";

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg(null); setBusy(true);
    try {
      if (modo === "criar") {
        const data = kind === "doctor" ? { ...doc, account_type: "doctor" } : { lab, full_name: lab.legal_name, account_type: "laboratory" };
        const { error } = await supabase.auth.signUp({ email, password: senha, options: { emailRedirectTo: window.location.origin, data } });
        if (error) throw error;
        setMsg({ tipo: "ok", texto: "Conta criada. Enviamos um e-mail de confirmação — clique no link para entrar." });
      } else {
        localStorage.setItem(INTENT_KEY, kind);
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
      }
    } catch (err) { localStorage.removeItem(INTENT_KEY); setMsg({ tipo: "erro", texto: errorText(err) }); } finally { setBusy(false); }
  };

  return (
    <>
      <h1 className="font-display text-3xl font-bold tracking-tight">Sou profissional de saúde</h1>
      <div role="radiogroup" aria-label="Tipo de profissional" className="mt-5 grid gap-2 sm:grid-cols-2">
        {([["doctor", "Médico ou profissional de saúde", Stethoscope], ["laboratory", "Laboratório ou clínica", Building2]] as const).map(([k, l, Icon]) => (
          <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => { setKind(k); setMsg(null); }} className={`flex min-h-16 items-center gap-3 rounded-xl border p-3 text-left text-sm font-semibold ${kind === k ? "border-primary bg-primary-soft text-primary" : "bg-card"}`}>
            <Icon className="h-5 w-5 shrink-0" aria-hidden />{l}
          </button>
        ))}
      </div>
      <ModeTabs modo={modo} setModo={(m) => { setModo(m); setMsg(null); }} />
      <form className="mt-2 space-y-4" onSubmit={enviar}>
        {modo === "criar" && (kind === "doctor" ? <DoctorFields f={doc} setF={setDoc} /> : <LabFields f={lab} setF={setLab} />)}
        {modo === "criar" && <p className="text-xs text-muted-foreground">{kind === "doctor" ? "O CRM aparece como informado por você" : "O CNPJ aparece como informado por você"}, até existir uma verificação oficial.</p>}
        <label className="block"><span className="text-sm font-medium">E-mail profissional</span><input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className={input} /></label>
        <label className="block"><span className="text-sm font-medium">Senha</span><input required minLength={6} type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete={modo === "criar" ? "new-password" : "current-password"} className={input} /></label>
        <Message msg={msg} />
        <button type="submit" disabled={busy} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary font-semibold text-primary-foreground disabled:opacity-60">
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}{modo === "criar" ? "Criar conta profissional" : "Entrar no VITA Clínico"}
        </button>
      </form>
      <Link to="/medico" className="mt-4 block text-center text-sm text-muted-foreground underline">Abrir só com o código do paciente, sem conta</Link>
    </>
  );
}
