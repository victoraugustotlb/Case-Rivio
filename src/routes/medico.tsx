import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { AlertCircle, ArrowLeft, Clock3, FolderOpen, Loader2, LockKeyhole, ShieldCheck, Stethoscope } from "lucide-react";
import { normalizeCode } from "@/lib/share";
import { PATIENT_CODE_LABEL, RETRY_LABEL, classifyCodeInput, failureFromError, isRetryable, openShareMessage } from "@/lib/codes";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { openShare } from "@/lib/documents.functions";
import { AccessEnded, ClinicalView, type Opened } from "@/components/vita/ClinicalView";

export const Route = createFileRoute("/medico")({
  validateSearch: (s: Record<string, unknown>): { code?: string } => (typeof s["code"] === "string" ? { code: s["code"] } : {}),
  head: () => ({
    meta: [
      { title: "VITA Clínico — Histórico autorizado do paciente" },
      { name: "description", content: "Acesse documentos, perfil de saúde e sinais autorizados pelo paciente com um código temporário." },
      { property: "og:title", content: "VITA Clínico — Histórico autorizado" },
      { property: "og:description", content: "Documentos e informações do paciente reunidos em uma visão clínica objetiva." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Medico,
});

function Medico() {
  const [input, setInput] = useState("");
  const [open, setOpen] = useState<Opened | null>(null);
  const [busy, setBusy] = useState(false);
  const abrir = useServerFn(openShare);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(false);
  const [ended, setEnded] = useState(false);
  const onEnded = useCallback(() => { setOpen(null); setEnded(true); }, []);
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => { void supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session)); }, []);
  const kind = classifyCodeInput(input);
  const code = normalizeCode(input);
  const valid = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code);

  const search = Route.useSearch();
  const openCode = async (c: string) => {
    if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(c)) return;
    setBusy(true); setError(""); setRetry(false);
    try {
      const result = await abrir({ data: { code: c } });
      if (result.status === "valido") setOpen(result);
      else { setError(openShareMessage(result.status)); setRetry(isRetryable(result.status)); }
    } catch (err) { setError(openShareMessage(failureFromError(err, navigator.onLine))); setRetry(true); } finally { setBusy(false); }
  };
  useEffect(() => {
    if (search.code) { const c = normalizeCode(search.code); setInput(c); void openCode(c); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.code]);

  const close = () => {
    setOpen(null); setInput(""); setError(""); setEnded(false);
  };

  if (ended) return <AccessEnded onBack={close} />;
  if (!open) {
    return (
      <main className="grid min-h-screen bg-background font-sans text-foreground lg:grid-cols-2">
        <section className="relative hidden overflow-hidden bg-hero p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between xl:p-16">
          <div className="flex items-center gap-3 font-display text-2xl font-bold"><span className="grid h-11 w-11 place-items-center rounded-xl bg-primary-foreground/10"><Stethoscope className="h-6 w-6" aria-hidden /></span>VITA Clínico</div>
          <div className="max-w-xl">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary-foreground/20 px-4 py-2 text-sm"><ShieldCheck className="h-4 w-4" aria-hidden />Histórico com consentimento do paciente</p>
            <h1 className="font-display text-5xl font-semibold leading-tight xl:text-6xl">Mais contexto.<br />Menos repetição.</h1>
            <p className="mt-6 max-w-lg text-lg text-primary-foreground/80">Documentos, medicamentos e histórico reunidos para você dedicar mais tempo à decisão clínica.</p>
          </div>
          <ul className="grid gap-4 text-sm sm:grid-cols-3">
            {[[FolderOpen, "Tudo em um lugar"], [Clock3, "Acesso temporário"], [LockKeyhole, "Escopo autorizado"]].map(([Icon, label]) => {
              const FeatureIcon = Icon as typeof FolderOpen;
              return <li key={label as string} className="flex items-center gap-2 text-primary-foreground/85"><FeatureIcon className="h-5 w-5 shrink-0" aria-hidden />{label as string}</li>;
            })}
          </ul>
        </section>

        <section className="relative flex min-h-screen items-center justify-center px-4 py-20 sm:px-8">
          <Link to={signedIn ? "/clinico" : "/entrar"} className="absolute left-5 top-5 inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"><ArrowLeft className="h-4 w-4" aria-hidden />Voltar</Link>
          <div className="w-full max-w-lg">
            <div className="mb-8 flex items-center gap-2 font-display text-2xl font-bold text-primary lg:hidden"><Stethoscope className="h-7 w-7" aria-hidden />VITA Clínico</div>
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">Acesso profissional</p>
            <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">Abrir histórico do paciente</h2>
            <p className="mt-3 text-muted-foreground">Use o código temporário mostrado pelo paciente. Não é necessário criar uma conta.</p>
            <form className="mt-8 rounded-2xl border bg-card p-5 shadow-soft sm:p-7" onSubmit={(event) => { event.preventDefault(); void openCode(code); }}>

              <label htmlFor="share-code" className="text-sm font-semibold">{PATIENT_CODE_LABEL}</label>
              <input id="share-code" value={input} onChange={(event) => setInput(normalizeCode(event.target.value))} placeholder="XXXX-XXXX" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={9} aria-describedby="code-help"
                className="mt-3 min-h-16 w-full rounded-xl border bg-background px-4 text-center font-display text-3xl font-semibold tracking-[0.2em] uppercase outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/20" />
              <p id="code-help" className="mt-2 text-center text-xs text-muted-foreground">8 caracteres · o hífen é adicionado automaticamente</p>
              {kind === "solicitacao" && <p role="status" className="mt-4 rounded-lg bg-warning-soft p-3 text-sm">Estes 6 números são um <strong>código de solicitação do médico</strong>: é o paciente quem o digita, em Autorizar médico, no app dele. Aqui vai o código do paciente (XXXX-XXXX). <Link to="/clinico/pedir" className="font-semibold text-primary underline">Acompanhar meu pedido</Link></p>}
              {error && <p role="alert" className="mt-4 flex items-start gap-2 rounded-lg bg-danger-soft p-3 text-sm"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /><span className="flex-1">{error}</span>{retry && <button type="button" onClick={() => void openCode(code)} className="font-semibold text-primary underline">{RETRY_LABEL}</button>}</p>}
              <button type="submit" disabled={!valid || busy} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <LockKeyhole className="h-4 w-4" aria-hidden />}{busy ? "Abrindo histórico…" : "Abrir histórico"}</button>
            </form>
            <p className="mt-5 flex items-start gap-2 text-sm text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />Você verá apenas as informações que o paciente escolheu compartilhar, durante a validade do código.</p>
          </div>
        </section>
      </main>
    );
  }


  return <ClinicalView opened={open} onClose={close} onEnded={onEnded} />;
}
