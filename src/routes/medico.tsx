import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Activity, AlertCircle, ArrowLeft, CalendarDays, ChevronRight, Clock3, FileText,
  FolderOpen, HeartPulse, LayoutDashboard, Loader2, LockKeyhole, LogOut, Pill,
  Search, ShieldCheck, Stethoscope, UserRound,
} from "lucide-react";
import { normalizeCode } from "@/lib/share";
import { useServerFn } from "@tanstack/react-start";
import { heartRate7d } from "@/lib/vita-data";
import { openShare } from "@/lib/documents.functions";
import { ageFromBirthDate, type HealthProfile } from "@/lib/profile";

type Opened = Extract<Awaited<ReturnType<typeof openShare>>, { status: "valido" }>;
type Doc = Opened["docs"][number];
type Tab = "resumo" | "paciente" | "documentos" | "linha" | "sinais";

const navItems = [
  { id: "resumo", label: "Visão geral", icon: LayoutDashboard },
  { id: "paciente", label: "Perfil do paciente", icon: UserRound },
  { id: "documentos", label: "Documentos", icon: FolderOpen },
  { id: "linha", label: "Linha do tempo", icon: Clock3 },
  { id: "sinais", label: "Sinais e dispositivos", icon: Activity },
] as const;

const headings: Record<Tab, { title: string; subtitle: string }> = {
  resumo: { title: "Visão geral", subtitle: "O essencial do histórico autorizado, em uma única tela." },
  paciente: { title: "Perfil do paciente", subtitle: "Informações declaradas pelo próprio paciente no questionário." },
  documentos: { title: "Documentos", subtitle: "Busque, filtre e abra os originais compartilhados." },
  linha: { title: "Linha do tempo", subtitle: "Documentos organizados para acompanhar a sequência do histórico." },
  sinais: { title: "Sinais e dispositivos", subtitle: "Dados de consumo são informativos e não substituem medições clínicas." },
};

const signalLabels: Record<string, string> = {
  fc: "Frequência cardíaca", sono: "Sono", spo2: "SpO₂", passos: "Passos", pressao: "Pressão arterial", glicose: "Glicose",
};

function formatDate(value: string | null): string {
  if (!value) return "Data não informada";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("pt-BR");
}

function docDate(doc: Doc): string {
  return formatDate(doc.doc_date || doc.created_at);
}

function textOrEmpty(value: string): string {
  return value.trim() || "Não informado";
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "PA";
  return `${parts[0]?.[0] ?? ""}${parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : ""}`.toUpperCase();
}

export const Route = createFileRoute("/medico")({
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

function ProfileDetails({ profile }: { profile: HealthProfile }) {
  const age = ageFromBirthDate(profile.birth_date);
  const history = [
    ["Alergias conhecidas", profile.allergies],
    ["Condições de saúde", profile.conditions],
    ["Cirurgias e internações", profile.surgeries],
    ["Histórico de saúde da família", profile.family_history],
  ] as const;
  const habits = [
    ["Tabagismo", profile.smoking],
    ["Consumo de álcool", profile.alcohol],
    ["Atividade física", profile.activity],
  ] as const;
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border bg-card p-5 shadow-soft sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><UserRound className="h-5 w-5 text-primary" aria-hidden />Sobre o paciente</h2>
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">{profile.questionnaire_completed ? "Questionário concluído" : "Respostas parciais"}</span>
        </div>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Nome completo", textOrEmpty(profile.full_name)],
            ["Data de nascimento", formatDate(profile.birth_date)],
            ["Idade", age === null ? "Não informada" : `${age} anos`],
            ["Altura e peso", `${profile.height_cm === null ? "—" : `${profile.height_cm} cm`} · ${profile.weight_kg === null ? "—" : `${profile.weight_kg} kg`}`],
          ].map(([label, value]) => <div key={label} className="rounded-xl bg-muted p-4"><dt className="text-xs font-medium text-muted-foreground">{label}</dt><dd className="mt-1 break-words font-semibold">{value}</dd></div>)}
        </dl>
      </section>

      <section className="rounded-2xl border bg-card p-5 shadow-soft sm:p-6">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><Pill className="h-5 w-5 text-primary" aria-hidden />Medicamentos em uso</h2>
        {profile.medications.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">Nenhum medicamento informado pelo paciente.</p> : (
          <ul className="mt-4 grid gap-3 lg:grid-cols-2">
            {profile.medications.map((medication, index) => <li key={`${medication.name}-${index}`} className="rounded-xl border p-4">
              <p className="font-semibold">{medication.name}</p>
              <dl className="mt-2 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs text-muted-foreground">Dose</dt><dd>{textOrEmpty(medication.dose)}</dd></div><div><dt className="text-xs text-muted-foreground">Frequência</dt><dd>{textOrEmpty(medication.frequency)}</dd></div></dl>
            </li>)}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border bg-card p-5 shadow-soft sm:p-6">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><HeartPulse className="h-5 w-5 text-primary" aria-hidden />Histórico de saúde</h2>
        <dl className="mt-4 grid gap-4 md:grid-cols-2">{history.map(([label, value]) => <div key={label} className="border-l-2 border-primary/30 pl-4"><dt className="text-sm font-semibold">{label}</dt><dd className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{textOrEmpty(value)}</dd></div>)}</dl>
      </section>

      <section className="rounded-2xl border bg-card p-5 shadow-soft sm:p-6">
        <h2 className="font-display text-lg font-semibold">Hábitos</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-3">{habits.map(([label, value]) => <div key={label} className="rounded-xl bg-muted p-4"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-sm font-semibold">{textOrEmpty(value)}</dd></div>)}</dl>
      </section>
    </div>
  );
}

function Medico() {
  const [input, setInput] = useState("");
  const [open, setOpen] = useState<Opened | null>(null);
  const [busy, setBusy] = useState(false);
  const abrir = useServerFn(openShare);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("resumo");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("Todos");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const code = normalizeCode(input);
  const valid = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code);

  const close = () => {
    setOpen(null); setInput(""); setError(""); setTab("resumo"); setSelectedId(null); setQuery(""); setKind("Todos");
  };

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
          <Link to="/entrar" className="absolute left-5 top-5 inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"><ArrowLeft className="h-4 w-4" aria-hidden />Voltar</Link>
          <div className="w-full max-w-lg">
            <div className="mb-8 flex items-center gap-2 font-display text-2xl font-bold text-primary lg:hidden"><Stethoscope className="h-7 w-7" aria-hidden />VITA Clínico</div>
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">Acesso profissional</p>
            <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">Abrir histórico do paciente</h2>
            <p className="mt-3 text-muted-foreground">Use o código temporário mostrado pelo paciente. Não é necessário criar uma conta.</p>
            <form className="mt-8 rounded-2xl border bg-card p-5 shadow-soft sm:p-7" onSubmit={async (event) => {
              event.preventDefault(); if (!valid) return; setBusy(true); setError("");
              try {
                const result = await abrir({ data: { code } });
                if (result.status === "valido") setOpen(result);
                else setError(result.status === "expirado" ? "Este código expirou. Peça ao paciente para gerar um novo." : result.status === "revogado" ? "O paciente encerrou este acesso." : "Código não encontrado. Confira os caracteres.");
              } catch { setError("Não foi possível abrir agora. Tente novamente."); } finally { setBusy(false); }
            }}>
              <label htmlFor="share-code" className="text-sm font-semibold">Código de acesso</label>
              <input id="share-code" value={input} onChange={(event) => setInput(normalizeCode(event.target.value))} placeholder="XXXX-XXXX" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={9} aria-describedby="code-help"
                className="mt-3 min-h-16 w-full rounded-xl border bg-background px-4 text-center font-display text-3xl font-semibold tracking-[0.2em] uppercase outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/20" />
              <p id="code-help" className="mt-2 text-center text-xs text-muted-foreground">8 caracteres · o hífen é adicionado automaticamente</p>
              {error && <p role="alert" className="mt-4 flex items-start gap-2 rounded-lg bg-danger-soft p-3 text-sm"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{error}</p>}
              <button type="submit" disabled={!valid || busy} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <LockKeyhole className="h-4 w-4" aria-hidden />}{busy ? "Abrindo histórico…" : "Abrir histórico"}</button>
            </form>
            <p className="mt-5 flex items-start gap-2 text-sm text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />Você verá apenas as informações que o paciente escolheu compartilhar, durante a validade do código.</p>
          </div>
        </section>
      </main>
    );
  }

  const docs = open.docs;
  const profile = open.profile;
  const remainingMinutes = Math.max(0, Math.floor((new Date(open.expiresAt).getTime() - Date.now()) / 60_000));
  const remaining = remainingMinutes >= 60 ? `${Math.floor(remainingMinutes / 60)}h ${remainingMinutes % 60}min` : `${remainingMinutes}min`;
  const patientName = open.includeProfile ? profile?.full_name.trim() || "Paciente" : "Histórico autorizado";
  const filteredDocs = docs.filter((doc) => (kind === "Todos" || doc.kind === kind) && `${doc.title} ${doc.source ?? ""} ${doc.summary ?? ""}`.toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR")));
  const selectedDoc = docs.find((doc) => doc.id === selectedId) ?? null;
  const kinds = ["Todos", ...new Set(docs.map((doc) => doc.kind))];
  const page = headings[tab];

  return (
    <div className="min-h-screen bg-background font-sans text-foreground lg:grid lg:grid-cols-[250px_minmax(0,1fr)]">
      <aside className="hidden bg-sidebar text-sidebar-foreground lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:p-5">
        <div className="flex items-center gap-2 px-2 font-display text-xl font-bold"><Stethoscope className="h-6 w-6 text-sidebar-primary" aria-hidden />VITA Clínico</div>
        <div className="mt-8 rounded-xl bg-sidebar-accent p-4">
          <p className="text-xs text-sidebar-foreground/70">Paciente em visualização</p>
          <p className="mt-1 break-words font-semibold">{patientName}</p>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-sidebar-foreground/70"><Clock3 className="h-3.5 w-3.5" aria-hidden />Expira em {remaining}</p>
        </div>
        <nav aria-label="Áreas do histórico" className="mt-6 space-y-1">
          {navItems.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => setTab(id)} aria-current={tab === id ? "page" : undefined} className={`flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium transition ${tab === id ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"}`}><Icon className={`h-5 w-5 shrink-0 ${tab === id ? "text-sidebar-primary" : ""}`} aria-hidden />{label}{id === "documentos" && <span className="ml-auto rounded-full bg-sidebar-accent px-2 py-0.5 text-xs">{docs.length}</span>}</button>)}
        </nav>
        <div className="mt-auto space-y-3">
          <p className="flex items-start gap-2 rounded-xl bg-sidebar-accent/60 p-3 text-xs text-sidebar-foreground/70"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />Conteúdo limitado às escolhas do paciente.</p>
          <button type="button" onClick={close} className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent"><LogOut className="h-4 w-4" aria-hidden />Encerrar acesso</button>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="border-b bg-card px-4 py-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary lg:hidden"><Stethoscope className="h-5 w-5" aria-hidden /></span>
              <div className="min-w-0"><p className="truncate text-xs text-muted-foreground">VITA Clínico · {code}</p><p className="truncate font-display font-semibold">{patientName}</p></div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="hidden rounded-full bg-warning-soft px-3 py-1.5 text-xs font-medium text-warning sm:inline-flex sm:items-center sm:gap-1.5"><Clock3 className="h-3.5 w-3.5" aria-hidden />Expira em {remaining}</span>
              <button type="button" onClick={close} className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium lg:hidden"><LogOut className="h-4 w-4" aria-hidden /><span className="hidden sm:inline">Encerrar</span></button>
            </div>
          </div>
          <nav aria-label="Áreas do histórico" className="-mx-4 mt-4 flex gap-1 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:hidden">
            {navItems.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => setTab(id)} aria-current={tab === id ? "page" : undefined} className={`flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium ${tab === id ? "bg-primary-soft text-primary" : "text-muted-foreground"}`}><Icon className="h-4 w-4" aria-hidden />{label}</button>)}
          </nav>
        </header>

        <main className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">
          <div className="mb-6"><h1 className="font-display text-2xl font-semibold sm:text-3xl">{page.title}</h1><p className="mt-1 text-sm text-muted-foreground sm:text-base">{page.subtitle}</p></div>

          {tab === "resumo" && <div className="space-y-5">
            <section className="rounded-2xl border bg-card p-5 shadow-soft sm:p-6">
              {open.includeProfile && profile ? <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:flex-wrap sm:justify-between">
                <div className="flex min-w-0 items-center gap-4"><span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-primary-soft font-display text-lg font-bold text-primary">{initials(profile.full_name)}</span><div className="min-w-0"><p className="break-words font-display text-xl font-semibold">{profile.full_name || "Paciente"}</p><p className="mt-1 text-sm text-muted-foreground">{ageFromBirthDate(profile.birth_date) === null ? "Idade não informada" : `${ageFromBirthDate(profile.birth_date)} anos`} · {profile.height_cm ?? "—"} cm · {profile.weight_kg ?? "—"} kg</p></div></div>
                <button type="button" onClick={() => setTab("paciente")} className="col-span-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-medium text-primary sm:col-span-1">Ver perfil completo<ChevronRight className="h-4 w-4" aria-hidden /></button>
              </div> : <div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"><UserRound className="h-5 w-5" aria-hidden /></span><div><h2 className="font-semibold">{open.includeProfile ? "Questionário ainda não preenchido" : "Perfil de saúde não compartilhado"}</h2><p className="mt-1 text-sm text-muted-foreground">{open.includeProfile ? "O paciente autorizou o perfil, mas ainda não adicionou suas informações." : "Este código dá acesso somente aos documentos e dados de dispositivos escolhidos pelo paciente."}</p></div></div>}
            </section>

            <dl className="grid gap-4 sm:grid-cols-3">
              {[[FolderOpen, "Documentos disponíveis", String(docs.length)], [Pill, "Medicamentos informados", profile && open.includeProfile ? String(profile.medications.length) : "—"], [Clock3, "Tempo restante", remaining]].map(([Icon, label, value]) => {
                const MetricIcon = Icon as typeof FolderOpen;
                return <div key={label as string} className="rounded-2xl border bg-card p-5"><dt className="flex items-center gap-2 text-sm text-muted-foreground"><MetricIcon className="h-4 w-4 text-primary" aria-hidden />{label as string}</dt><dd className="mt-3 font-display text-3xl font-semibold">{value as string}</dd></div>;
              })}
            </dl>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)]">
              <section className="rounded-2xl border bg-card p-5 shadow-soft sm:p-6">
                <div className="flex items-center justify-between gap-3"><h2 className="font-display text-lg font-semibold">Documentos recentes</h2>{docs.length > 0 && <button type="button" onClick={() => setTab("documentos")} className="min-h-11 text-sm font-medium text-primary">Ver todos</button>}</div>
                {docs.length === 0 ? <div className="py-10 text-center"><FileText className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden /><p className="mt-3 text-sm text-muted-foreground">Nenhum documento autorizado neste período.</p></div> : <ul className="mt-3 divide-y">{docs.slice(0, 4).map((doc) => <li key={doc.id}><button type="button" onClick={() => { setSelectedId(doc.id); setTab("documentos"); }} className="flex min-h-16 w-full items-center gap-3 py-3 text-left"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary"><FileText className="h-5 w-5" aria-hidden /></span><span className="min-w-0 flex-1"><span className="block truncate font-medium">{doc.title}</span><span className="mt-0.5 block text-xs text-muted-foreground">{doc.kind} · {docDate(doc)}</span></span><ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden /></button></li>)}</ul>}
              </section>

              <section className="rounded-2xl border bg-card p-5 shadow-soft sm:p-6">
                <h2 className="font-display text-lg font-semibold">Informações para atenção</h2>
                {open.includeProfile && profile ? <dl className="mt-4 space-y-4 text-sm"><div><dt className="font-semibold">Alergias</dt><dd className="mt-1 whitespace-pre-wrap text-muted-foreground">{textOrEmpty(profile.allergies)}</dd></div><div><dt className="font-semibold">Condições de saúde</dt><dd className="mt-1 whitespace-pre-wrap text-muted-foreground">{textOrEmpty(profile.conditions)}</dd></div><div><dt className="font-semibold">Medicamentos</dt><dd className="mt-1 text-muted-foreground">{profile.medications.length ? profile.medications.map((medication) => medication.name).join(", ") : "Nenhum medicamento informado."}</dd></div></dl> : <p className="mt-4 text-sm text-muted-foreground">Essas informações aparecem quando o paciente compartilha e preenche o perfil de saúde.</p>}
              </section>
            </div>
          </div>}

          {tab === "paciente" && (!open.includeProfile ? <EmptyState icon={LockKeyhole} title="Perfil não incluído neste acesso" text="O paciente precisa marcar “Perfil de saúde” ao gerar o código para liberar estas informações." /> : !profile ? <EmptyState icon={UserRound} title="Questionário ainda não preenchido" text="O paciente autorizou o compartilhamento, mas ainda não salvou informações no perfil." /> : <><ProfileDetails profile={profile} /><p className="mt-5 flex items-start gap-2 text-sm text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />Informações autodeclaradas pelo paciente. Ausência de resposta significa “não informado”, não ausência da condição.</p></>)}

          {tab === "documentos" && <div className="space-y-5">
            <section className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-[minmax(0,1fr)_220px]">
              <label className="relative block"><span className="sr-only">Buscar documentos</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden /><input value={query} onChange={(event) => { setQuery(event.target.value); setSelectedId(null); }} placeholder="Buscar por nome, origem ou conteúdo" className="min-h-11 w-full rounded-lg border bg-background pl-10 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/20" /></label>
              <label><span className="sr-only">Filtrar por tipo</span><select value={kind} onChange={(event) => { setKind(event.target.value); setSelectedId(null); }} className="min-h-11 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/20">{kinds.map((option) => <option key={option}>{option}</option>)}</select></label>
            </section>
            <p className="text-sm text-muted-foreground">{filteredDocs.length} de {docs.length} documento(s) · últimos {open.periodMonths} meses</p>
            <div className={`grid gap-5 ${selectedDoc ? "xl:grid-cols-[minmax(0,1fr)_380px]" : ""}`}>
              <section className="overflow-hidden rounded-2xl border bg-card shadow-soft">
                {filteredDocs.length === 0 ? <EmptyState icon={FileText} title="Nenhum documento encontrado" text={docs.length ? "Tente outro termo ou remova o filtro por tipo." : "Não há documentos autorizados neste compartilhamento e período."} /> : <ul className="divide-y">{filteredDocs.map((doc) => <li key={doc.id}><button type="button" aria-pressed={selectedId === doc.id} onClick={() => setSelectedId(selectedId === doc.id ? null : doc.id)} className={`grid min-h-20 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-4 text-left transition hover:bg-muted ${selectedId === doc.id ? "bg-primary-soft" : ""}`}>
                  <span className="grid h-11 w-11 place-items-center rounded-lg bg-primary-soft text-primary"><FileText className="h-5 w-5" aria-hidden /></span><span className="min-w-0"><span className="block truncate font-semibold">{doc.title}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{doc.kind} · {docDate(doc)}{doc.source ? ` · ${doc.source}` : ""}</span></span><ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
                </button></li>)}</ul>}
              </section>
              {selectedDoc && <aside className="h-fit rounded-2xl border bg-card p-5 shadow-soft xl:sticky xl:top-6">
                <p className="text-xs font-medium text-primary">{selectedDoc.kind} · {docDate(selectedDoc)}</p><h2 className="mt-2 break-words font-display text-xl font-semibold">{selectedDoc.title}</h2><p className="mt-2 text-sm text-muted-foreground">{[selectedDoc.source, selectedDoc.origin].filter(Boolean).join(" · ") || "Origem não informada"}</p>
                {selectedDoc.summary && <p className="mt-4 rounded-xl bg-muted p-4 text-sm">{selectedDoc.summary}</p>}
                {selectedDoc.fields.length > 0 && <dl className="mt-4 space-y-3">{selectedDoc.fields.map((field, index) => <div key={`${field.label}-${index}`} className="border-b pb-3 text-sm last:border-0"><dt className="text-xs text-muted-foreground">{field.label}</dt><dd className="mt-1 font-medium">{field.value}</dd></div>)}</dl>}
                {selectedDoc.url ? <a href={selectedDoc.url} target="_blank" rel="noreferrer" className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"><FileText className="h-4 w-4" aria-hidden />Abrir documento original</a> : <p className="mt-5 text-sm text-muted-foreground">Original não disponível.</p>}
                <button type="button" onClick={() => setSelectedId(null)} className="mt-2 min-h-11 w-full rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted">Fechar detalhes</button>
              </aside>}
            </div>
          </div>}

          {tab === "linha" && (docs.length === 0 ? <EmptyState icon={Clock3} title="Linha do tempo vazia" text="Não há documentos autorizados neste compartilhamento e período." /> : <ol className="relative space-y-4 before:absolute before:bottom-5 before:left-[19px] before:top-5 before:w-px before:bg-border">
            {docs.map((doc) => <li key={doc.id} className="relative grid grid-cols-[40px_minmax(0,1fr)] gap-3"><span className="z-10 mt-5 grid h-10 w-10 place-items-center rounded-full border-4 border-background bg-primary-soft text-primary"><CalendarDays className="h-4 w-4" aria-hidden /></span><button type="button" onClick={() => { setSelectedId(doc.id); setTab("documentos"); }} className="rounded-2xl border bg-card p-5 text-left shadow-soft transition hover:border-primary"><span className="text-xs font-medium text-primary">{docDate(doc)} · {doc.kind}</span><span className="mt-1 block font-display text-lg font-semibold">{doc.title}</span><span className="mt-1 block text-sm text-muted-foreground">{[doc.source, doc.origin].filter(Boolean).join(" · ") || "Origem não informada"} · conferido pelo paciente</span></button></li>)}
          </ol>)}

          {tab === "sinais" && (open.signals.length === 0 ? <EmptyState icon={Activity} title="Nenhum dado de dispositivo compartilhado" text="O paciente não autorizou sinais ou dispositivos neste código." /> : <div className="space-y-5">
            <section className="rounded-2xl border bg-card p-5 sm:p-6"><h2 className="font-display text-lg font-semibold">Dados autorizados</h2><ul className="mt-4 flex flex-wrap gap-2">{open.signals.map((signal) => <li key={signal} className="rounded-full bg-primary-soft px-3 py-2 text-sm font-medium text-primary">{signalLabels[signal] ?? signal}</li>)}</ul><p className="mt-4 rounded-xl bg-warning-soft p-4 text-sm text-warning">A integração com dispositivos ainda não está conectada. Os valores exibidos nesta área são apenas demonstrativos.</p></section>
            {open.signals.includes("fc") && <section className="rounded-2xl border bg-card p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-display text-lg font-semibold"><HeartPulse className="h-5 w-5 text-primary" aria-hidden />Frequência cardíaca em repouso · 7 dias</h2><span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">Demonstração</span></div><div className="mt-6 flex h-48 items-end gap-2 sm:gap-3" aria-label="Gráfico demonstrativo de frequência cardíaca">{heartRate7d.map((value, index) => <div key={index} className="flex min-w-0 flex-1 flex-col items-center gap-2"><span className="text-xs text-muted-foreground">{value}</span><div className="w-full rounded-t-md bg-primary" style={{ height: `${Math.max(10, ((value - 60) / 25) * 100)}%` }} /><span className="text-xs text-muted-foreground">{index + 1}</span></div>)}</div></section>}
          </div>)}
        </main>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, text }: { icon: typeof FileText; title: string; text: string }) {
  return <section className="rounded-2xl border bg-card px-5 py-16 text-center shadow-soft"><span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-muted text-muted-foreground"><Icon className="h-6 w-6" aria-hidden /></span><h2 className="mt-4 font-display text-xl font-semibold">{title}</h2><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{text}</p></section>;
}
