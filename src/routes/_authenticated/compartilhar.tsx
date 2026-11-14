import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Copy, Info, ShieldCheck, ShieldOff, UserRound } from "lucide-react";
import { AppShell, PageTitle } from "@/components/vita/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createMinorShareCode } from "@/lib/family.functions";
import { attachShareToAppointment } from "@/lib/scheduling.functions";
import { createShareCode } from "@/lib/share.functions";
import { PATIENT_CODE_LABEL, createShareMessage } from "@/lib/codes";
import { PERIOD_OPTIONS, VALIDITY_OPTIONS, validateShare, type ShareCategory, type ShareSignal } from "@/lib/share";

export const Route = createFileRoute("/_authenticated/compartilhar")({
  head: () => ({
    meta: [
      { title: "Compartilhar com médico — VITA" },
      { name: "description", content: "Escolha o que o médico pode ver, por quanto tempo, e gere um código temporário." },
      { property: "og:title", content: "Compartilhar com médico — VITA" },
      { property: "og:description", content: "Acesso temporário e granular ao seu histórico." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => z.object({ para: z.string().uuid().optional(), consulta: z.string().uuid().optional(), ate: z.string().datetime({ offset: true }).optional() }).catch({}).parse(s),
  component: Compartilhar,
});

const cats: { id: ShareCategory; label: string }[] = [
  { id: "exames", label: "Exames" }, { id: "laudos", label: "Laudos" }, { id: "consultas", label: "Consultas antigas" }, { id: "receitas", label: "Receitas" }, { id: "vacinas", label: "Vacinas" },
];
const sigs: { id: ShareSignal; label: string }[] = [
  { id: "fc", label: "Frequência cardíaca" }, { id: "sono", label: "Sono" }, { id: "spo2", label: "SpO₂" }, { id: "passos", label: "Passos" }, { id: "pressao", label: "Pressão arterial" }, { id: "glicose", label: "Glicose" },
];
const periodLabel = (m: number) => (m >= 12 ? `${m / 12} ano${m > 12 ? "s" : ""}` : `${m} meses`);
const validityLabel = (h: number) => (h === 1 ? "1 hora" : h === 24 ? "24 horas" : h === 72 ? "3 dias" : "7 dias");

function toggle<T>(list: T[], v: T) { return list.includes(v) ? list.filter((x) => x !== v) : [...list, v]; }

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" role="checkbox" aria-checked={on} onClick={onClick}
      className={`flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm font-medium ${on ? "border-primary bg-primary-soft text-primary" : "bg-card hover:bg-muted"}`}>
      <span className={`grid h-4 w-4 place-items-center rounded border ${on ? "border-primary bg-primary text-primary-foreground" : ""}`}>{on && <Check className="h-3 w-3" aria-hidden />}</span>{children}
    </button>
  );
}

function Compartilhar() {
  const { para, consulta, ate } = Route.useSearch();
  const attach = useServerFn(attachShareToAppointment);
  const untilAppt = consulta && ate && new Date(ate).getTime() > Date.now() ? ate : null;
  const untilLabel = untilAppt ? new Date(untilAppt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }) : "";
  const createMinor = useServerFn(createMinorShareCode);
  const createCode = useServerFn(createShareCode);
  const [categories, setCategories] = useState<ShareCategory[]>([]);
  const [signals, setSignals] = useState<ShareSignal[]>([]);
  const [includeProfile, setIncludeProfile] = useState(false);
  const [periodMonths, setPeriod] = useState(12);
  const [validityHours, setValidity] = useState(24);
  const [code, setCode] = useState<string | null>(null);
  const [revoked, setRevoked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState("");
  const errors = validateShare({ categories, signals, includeProfile, periodMonths, validityHours });
  const gerar = async () => {
    setBusy(true); setFail("");
    try {
      if (para) {
        const r = await createMinor({ data: { memberId: para, categories, signals, includeProfile, periodMonths, validityHours } });
        if (r.ok) setCode(r.code); else setFail(r.error);
        return;
      }
      const r = await createCode({ data: { categories, signals, includeProfile, periodMonths, validityHours, ...(untilAppt ? { until: untilAppt } : {}) } });
      if (!r.ok) { setFail(createShareMessage(r.error)); return; }
      if (untilAppt && consulta) await attach({ data: { id: consulta, code: r.code } }).catch(() => undefined);
      setCode(r.code);
    } catch { setFail(createShareMessage("falha_servidor")); } finally { setBusy(false); }
  };

  if (code) {
    return (
      <AppShell>
        <div className="mx-auto max-w-xl text-center">
          <PageTitle title={revoked ? "Acesso encerrado" : "Código pronto"} subtitle={revoked ? "O médico não consegue mais abrir seu histórico com este código." : untilAppt ? `Válido até o fim da consulta (${untilLabel}).` : `Válido por ${validityLabel(validityHours)}. Mostre ao médico.`} />
          <div className={`rounded-2xl border bg-card p-8 ${revoked ? "opacity-50" : ""}`}>
            <p className="text-sm text-muted-foreground">{PATIENT_CODE_LABEL}</p>
            <p className="mt-2 font-display text-5xl font-bold tracking-widest text-primary">{code}</p>
            <p className="mt-4 text-sm text-muted-foreground">O médico acessa em <strong>{typeof window !== "undefined" ? window.location.host : ""}/medico</strong> no computador dele.</p>
            <ul className="mt-4 flex flex-wrap justify-center gap-2 text-xs">
              {includeProfile && <li className="rounded-full bg-primary-soft px-2 py-1 text-primary">Perfil de saúde</li>}
              {[...cats.filter((c) => categories.includes(c.id)), ...sigs.filter((s) => signals.includes(s.id))].map((x) => <li key={x.id} className="rounded-full bg-muted px-2 py-1">{x.label}</li>)}
              <li className="rounded-full bg-muted px-2 py-1">Últimos {periodLabel(periodMonths)}</li>
            </ul>
          </div>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            {!revoked && <button type="button" onClick={() => navigator.clipboard?.writeText(code)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border bg-card px-4 font-medium"><Copy className="h-4 w-4" aria-hidden /> Copiar</button>}
            {!revoked && <button type="button" onClick={async () => { const { error } = await supabase.from("share_codes").update({ revoked: true }).eq("code", code); if (!error) setRevoked(true); }} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-destructive px-4 font-semibold text-destructive-foreground"><ShieldOff className="h-4 w-4" aria-hidden /> Encerrar acesso</button>}
            <button type="button" onClick={() => { setCode(null); setRevoked(false); }} className="min-h-11 rounded-lg px-4 font-medium text-primary">Novo compartilhamento</button>
            <Link to="/medico" className="min-h-11 content-center rounded-lg px-4 text-sm text-muted-foreground underline">Ver como o médico vê</Link>
            <Link to="/autorizar" className="min-h-11 content-center rounded-lg px-4 text-sm font-medium text-primary underline">Autorizar código do médico</Link>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <PageTitle title="Compartilhar com médico" subtitle="Você escolhe o que ele vê. Nada vem marcado." />
        {untilAppt && <p role="status" className="mb-4 rounded-lg bg-primary-soft p-3 text-sm">Compartilhamento para a consulta agendada. Escolha o que o profissional poderá ver.</p>}
        {para && <p role="status" className="mb-4 rounded-lg bg-warning-soft p-3 text-sm">Este código abre o histórico do seu dependente menor de idade, gerado por você como responsável legal.</p>}
        <section className="rounded-2xl border bg-card p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary"><UserRound className="h-5 w-5" aria-hidden /></span>
            <div className="min-w-0"><h2 className="font-semibold">1. Perfil de saúde</h2><p className="mt-1 text-sm text-muted-foreground">Inclui dados pessoais, medicamentos, alergias, histórico e hábitos do questionário.</p></div>
          </div>
          <button type="button" role="switch" aria-checked={includeProfile} onClick={() => setIncludeProfile((value) => !value)} className={`mt-4 flex min-h-12 w-full items-center justify-between gap-4 rounded-lg border px-4 text-left text-sm font-medium ${includeProfile ? "border-primary bg-primary-soft text-primary" : "bg-card hover:bg-muted"}`}>
            <span>{includeProfile ? "Perfil autorizado neste código" : "Não compartilhar o perfil"}</span>
            <span aria-hidden className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${includeProfile ? "bg-primary" : "bg-muted-foreground/30"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-card transition-transform ${includeProfile ? "translate-x-1 left-1/2" : "left-1"}`} /></span>
          </button>
          <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />Códigos já criados não mudam: este consentimento vale apenas para o novo código.</p>
        </section>
        <section className="rounded-2xl border bg-card p-5">
          <h2 className="font-semibold">2. Documentos</h2>
          <div className="mt-3 flex flex-wrap gap-2">{cats.map((c) => <Chip key={c.id} on={categories.includes(c.id)} onClick={() => setCategories((l) => toggle(l, c.id))}>{c.label}</Chip>)}</div>
        </section>
        <section className="rounded-2xl border bg-card p-5">
          <h2 className="font-semibold">3. Dados de dispositivos</h2>
          <div className="mt-3 flex flex-wrap gap-2">{sigs.map((s) => <Chip key={s.id} on={signals.includes(s.id)} onClick={() => setSignals((l) => toggle(l, s.id))}>{s.label}</Chip>)}</div>
        </section>
        <div className="grid gap-6 sm:grid-cols-2">
          <section className="rounded-2xl border bg-card p-5">
            <h2 className="font-semibold">4. Dados de quando</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">{PERIOD_OPTIONS.map((m) => <Chip key={m} on={periodMonths === m} onClick={() => setPeriod(m)}>{periodLabel(m)}</Chip>)}</div>
          </section>
          <section className="rounded-2xl border bg-card p-5">
            <h2 className="font-semibold">5. Acesso válido por</h2>
            {untilAppt ? <p className="mt-3 rounded-lg bg-primary-soft p-3 text-sm text-primary">Até o fim da consulta agendada ({untilLabel}).</p> : <div className="mt-3 grid grid-cols-2 gap-2">{VALIDITY_OPTIONS.map((h) => <Chip key={h} on={validityHours === h} onClick={() => setValidity(h)}>{validityLabel(h)}</Chip>)}</div>}
          </section>
        </div>
        <p className="flex gap-2 rounded-xl bg-primary-soft p-4 text-sm"><Info className="h-5 w-5 shrink-0 text-primary" aria-hidden /> Encerrar o acesso impede novas consultas, mas não desfaz o que o médico já viu.</p>
        {errors.length > 0 && <p className="text-sm text-muted-foreground">{errors[0]}</p>}
        {fail && <p role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-danger-soft p-3 text-sm"><span>{fail}</span><button type="button" onClick={() => void gerar()} className="min-h-11 rounded-lg border bg-card px-4 font-semibold">Tentar de novo</button></p>}
        <button type="button" disabled={errors.length > 0 || busy} onClick={() => void gerar()}
          className="min-h-12 w-full rounded-lg bg-primary font-semibold text-primary-foreground disabled:opacity-50">{busy ? "Gerando…" : "Gerar código"}</button>
      </div>
    </AppShell>
  );
}
