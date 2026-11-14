import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Loader2, ShieldCheck, Stethoscope } from "lucide-react";
import { AppShell, PageTitle } from "@/components/vita/AppShell";
import { EssentialsPicker, useEssentialsChoice } from "@/components/vita/EssentialsPicker";
import { lookupAccessRequest, respondAccessRequest } from "@/lib/clinic.functions";
import { AUTHORIZED_HOURS, formatRequestCode, isRequestCode, normalizeRequestCode } from "@/lib/clinic";
import { REQUEST_CODE_LABEL, classifyCodeInput, requestLookupMessage } from "@/lib/codes";

export const Route = createFileRoute("/_authenticated/autorizar")({
  head: () => ({
    meta: [
      { title: "Autorizar médico — Anamedis" },
      { name: "description", content: "Digite o código de 6 dígitos do seu médico e escolha se libera o acesso." },
      { property: "og:title", content: "Autorizar médico — Anamedis" },
      { property: "og:description", content: "Libere ao seu médico apenas o que ele pediu, por tempo limitado." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Autorizar,
});

const CAT: Record<string, string> = { exames: "Exames", laudos: "Laudos", consultas: "Consultas antigas", receitas: "Receitas", vacinas: "Vacinas" };
const SIG: Record<string, string> = { fc: "Frequência cardíaca", sono: "Sono", spo2: "Oxigenação", passos: "Passos", pressao: "Pressão", glicose: "Glicose" };
type Found = Extract<Awaited<ReturnType<typeof lookupAccessRequest>>, { ok: true }>;

function Autorizar() {
  const [raw, setRaw] = useState("");
  const code = normalizeRequestCode(raw);
  const kind = classifyCodeInput(raw);
  const [found, setFound] = useState<Found | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<"ok" | "no" | null>(null);
  const [allowUpload, setAllowUpload] = useState(false);
  const [essentials, setEssentials] = useEssentialsChoice();
  const lookup = useServerFn(lookupAccessRequest);
  const respond = useServerFn(respondAccessRequest);
  const qc = useQueryClient();

  const buscar = async (e: React.FormEvent) => {
    e.preventDefault(); if (!isRequestCode(code)) return;
    setBusy(true); setError("");
    try {
      const r = await lookup({ data: { code } });
      if (!r.ok) { setError(requestLookupMessage(r.reason)); setFound(null); } else setFound(r);
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível verificar."); } finally { setBusy(false); }
  };
  const responder = async (accept: boolean) => {
    setBusy(true); setError("");
    try { await respond({ data: { code, accept, allowUpload: accept && allowUpload, includeEssentials: accept && essentials.include && essentials.fields.length > 0, essentialsFields: essentials.fields } }); setDone(accept ? "ok" : "no"); qc.invalidateQueries(); }
    catch (err) { setError(err instanceof Error ? err.message : "Não foi possível responder."); } finally { setBusy(false); }
  };

  return (
    <AppShell>
      <PageTitle title="Autorizar médico" subtitle="Digite o código de 6 dígitos que o profissional mostrou." />
      <div className="max-w-xl">
        {done ? (
          <div className="rounded-2xl border bg-card p-6 text-center shadow-soft">
            <CheckCircle2 className="mx-auto h-10 w-10 text-primary" aria-hidden />
            <p className="mt-3 font-display text-xl font-semibold">{done === "ok" ? "Acesso liberado" : "Solicitação recusada"}</p>
            <p className="mt-2 text-sm text-muted-foreground">{done === "ok" ? `O histórico já abriu na tela do médico e fica disponível por ${AUTHORIZED_HOURS} horas. Você pode encerrar a qualquer momento em Compartilhar.` : "O médico não verá nenhuma informação sua."}</p>
            <Link to="/compartilhar" className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-primary px-5 font-semibold text-primary-foreground">Ver meus acessos</Link>
          </div>
        ) : !found ? (
          <form onSubmit={buscar} className="rounded-2xl border bg-card p-6 shadow-soft">
            <label htmlFor="req-code" className="text-sm font-semibold">{REQUEST_CODE_LABEL}</label>
            <input id="req-code" autoComplete="one-time-code" value={kind === "solicitacao" ? formatRequestCode(code) : raw} onChange={(e) => setRaw(e.target.value.toUpperCase().slice(0, 9))} placeholder="000 000"
              className="mt-3 min-h-16 w-full rounded-xl border bg-background text-center font-display text-3xl font-semibold tracking-[0.3em] outline-none focus:border-primary focus:ring-2 focus:ring-ring/20" />
            {kind === "paciente" && <p role="status" className="mt-4 rounded-lg bg-warning-soft p-3 text-sm">Este é um <strong>código do paciente</strong> (letras e números): é você quem gera e mostra ao médico, que o digita na tela dele. Aqui vai o código de 6 números que o médico mostrou. <Link to="/compartilhar" className="font-semibold text-primary underline">Ir para Compartilhar</Link></p>}
            {error && <p role="alert" className="mt-4 flex gap-2 rounded-lg bg-danger-soft p-3 text-sm"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{error}</p>}
            <button disabled={!isRequestCode(code) || busy} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary font-semibold text-primary-foreground disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Continuar</button>
          </form>
        ) : (
          <div className="rounded-2xl border bg-card p-6 shadow-soft">
            <div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-xl bg-accent text-primary"><Stethoscope className="h-6 w-6" aria-hidden /></span>
              <div><p className="font-display text-lg font-semibold">{found.doctor.full_name}</p><p className="text-sm text-muted-foreground">{found.doctor.credential}</p></div></div>
            <p className="mt-2 text-xs text-muted-foreground">{found.doctor.kind === "laboratory" ? "CNPJ informado pelo laboratório; confira se é quem está te atendendo." : "CRM informado pelo profissional; confira se é o médico que está te atendendo."}</p>
            <p className="mt-5 font-semibold">Pede acesso a:</p>
            <ul className="mt-2 space-y-1 text-sm">
              {found.includeProfile && <li>• Perfil de saúde (questionário, medicamentos, alergias)</li>}
              {found.categories.map((c) => <li key={c}>• {CAT[c] ?? c}</li>)}
              {found.signals.map((s) => <li key={s}>• {SIG[s] ?? s} (dispositivos)</li>)}
            </ul>
            <p className="mt-3 text-sm text-muted-foreground">Documentos dos últimos {found.periodMonths === 60 ? "5 anos" : `${found.periodMonths} meses`} · acesso por {AUTHORIZED_HOURS} horas</p>
            <div className="mt-5"><EssentialsPicker value={essentials} onChange={setEssentials} title="Ficha essencial (sua escolha)" /></div>
            {found.requestUpload && (
              <label className="mt-5 flex cursor-pointer items-start justify-between gap-4 rounded-xl border p-4">
                <span className="text-sm"><span className="block font-semibold">Permissão para enviar documentos</span>Permitir que este profissional adicione documentos ao meu histórico enquanto o acesso estiver ativo</span>
                <input type="checkbox" role="switch" checked={allowUpload} onChange={(e) => setAllowUpload(e.target.checked)} className="mt-1 h-6 w-11 shrink-0 cursor-pointer appearance-none rounded-full bg-muted transition before:block before:h-5 before:w-5 before:translate-x-0.5 before:rounded-full before:bg-card before:shadow before:transition checked:bg-primary checked:before:translate-x-5" />
              </label>
            )}
            {found.requestUpload && <p className="mt-2 text-xs text-muted-foreground">Cada documento enviado fica aguardando sua aceitação antes de entrar no histórico.</p>}
            {error && <p role="alert" className="mt-4 rounded-lg bg-danger-soft p-3 text-sm">{error}</p>}
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button disabled={busy} onClick={() => responder(false)} className="min-h-12 rounded-lg border font-semibold">Recusar</button>
              <button disabled={busy} onClick={() => responder(true)} className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-primary font-semibold text-primary-foreground"><ShieldCheck className="h-4 w-4" aria-hidden />Autorizar</button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
