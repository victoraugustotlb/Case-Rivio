import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock3, KeyRound, Loader2, LogOut, Plus, RefreshCw, Search, Stethoscope, UserRound, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createAccessRequest, getAccessRequest } from "@/lib/clinic.functions";
import { formatRequestCode } from "@/lib/clinic";
import { PERIOD_OPTIONS, type ShareCategory, type ShareSignal } from "@/lib/share";

export const Route = createFileRoute("/clinico")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Painel do profissional — VITA Clínico" },
      { name: "description", content: "Histórico de pacientes atendidos e solicitações de acesso por código de 6 dígitos." },
      { property: "og:title", content: "Painel do profissional — VITA Clínico" },
      { property: "og:description", content: "Peça ao paciente apenas as informações de que precisa para a consulta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Clinico,
});

const CATS: [ShareCategory, string][] = [["exames", "Exames"], ["laudos", "Laudos"], ["consultas", "Consultas antigas"], ["receitas", "Receitas"], ["vacinas", "Vacinas"]];
const SIGS: [ShareSignal, string][] = [["fc", "Freq. cardíaca"], ["pressao", "Pressão"], ["glicose", "Glicose"], ["sono", "Sono"], ["spo2", "Oxigenação"], ["passos", "Passos"]];

function useDoctor() {
  return useQuery({
    queryKey: ["doctor-me"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return { user: null, doctor: null };
      let { data: doctor } = await supabase.from("doctor_profiles").select("*").eq("user_id", u.user.id).maybeSingle();
      const m = u.user.user_metadata as Record<string, string | undefined>;
      if (!doctor && m["account_type"] === "doctor" && m["crm"] && m["uf"]) {
        const { data } = await supabase.from("doctor_profiles").insert({ full_name: m["full_name"] ?? "", crm: m["crm"], uf: m["uf"], specialty: m["specialty"] ?? "" }).select("*").single();
        doctor = data;
      }
      return { user: u.user, doctor };
    },
  });
}

function Clinico() {
  const nav = useNavigate();
  const me = useDoctor();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [modal, setModal] = useState<{ patientId?: string; name?: string } | null>(null);
  useEffect(() => { if (me.data && !me.data.user) nav({ to: "/entrar", replace: true }); }, [me.data, nav]);
  const patients = useQuery({
    queryKey: ["doctor-patients"], enabled: !!me.data?.doctor,
    queryFn: async () => (await supabase.from("doctor_patients").select("patient_id, patient_name, patient_ref, last_seen_at").order("last_seen_at", { ascending: false })).data ?? [],
  });
  const sair = async () => { qc.clear(); await supabase.auth.signOut(); nav({ to: "/entrar", replace: true }); };

  if (me.isLoading || !me.data?.user) return <div className="grid min-h-screen place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="Carregando" /></div>;
  if (!me.data.doctor) return <NoDoctor onDone={() => me.refetch()} />;
  const list = (patients.data ?? []).filter((p) => `${p.patient_name} ${p.patient_ref}`.toLowerCase().includes(q.toLowerCase()));
  const d = me.data.doctor;

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-8">
          <div className="flex items-center gap-2 font-display text-xl font-bold text-primary"><Stethoscope className="h-6 w-6" aria-hidden />VITA Clínico</div>
          <div className="flex items-center gap-2">
            <span className="hidden text-right text-sm sm:block"><span className="block font-semibold">{d.full_name}</span><span className="text-muted-foreground">CRM {d.crm}/{d.uf}</span></span>
            <button onClick={sair} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted"><LogOut className="h-4 w-4" aria-hidden />Sair</button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
        <div className="grid gap-4 md:grid-cols-2">
          <button onClick={() => setModal({})} className="flex min-h-28 items-center gap-4 rounded-2xl bg-hero p-6 text-left text-primary-foreground shadow-soft">
            <Plus className="h-8 w-8 shrink-0" aria-hidden /><span><span className="block font-display text-xl font-semibold">Novo paciente</span><span className="text-sm text-primary-foreground/80">Gere um código de 6 dígitos e entregue ao paciente</span></span>
          </button>
          <Link to="/medico" className="flex min-h-28 items-center gap-4 rounded-2xl border bg-card p-6 shadow-soft">
            <KeyRound className="h-8 w-8 shrink-0 text-primary" aria-hidden /><span><span className="block font-display text-xl font-semibold">Tenho um código do paciente</span><span className="text-sm text-muted-foreground">Abra um histórico com o código que o paciente gerou</span></span>
          </Link>
        </div>

        <section className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><h1 className="font-display text-2xl font-bold">Pacientes atendidos</h1><p className="text-sm text-muted-foreground">Somente nome e ID. Para ver informações, peça um novo acesso.</p></div>
            <label className="relative w-full sm:w-72"><Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" aria-hidden /><span className="sr-only">Buscar paciente</span>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou ID" className="min-h-11 w-full rounded-lg border bg-card pl-9 pr-3" /></label>
          </div>
          {patients.isLoading ? <Loader2 className="mt-6 h-5 w-5 animate-spin text-primary" aria-hidden /> : list.length === 0 ? (
            <p className="mt-6 rounded-2xl border border-dashed p-8 text-center text-muted-foreground">{q ? "Nenhum paciente encontrado." : "Nenhum paciente ainda. Quando alguém autorizar um código seu, aparecerá aqui."}</p>
          ) : (
            <ul className="mt-6 divide-y rounded-2xl border bg-card">
              {list.map((p) => (
                <li key={p.patient_id}>
                  <button onClick={() => setModal({ patientId: p.patient_id, name: p.patient_name })} className="flex min-h-16 w-full items-center gap-4 px-5 py-3 text-left hover:bg-muted">
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-accent text-primary"><UserRound className="h-5 w-5" aria-hidden /></span>
                    <span className="flex-1"><span className="block font-semibold">{p.patient_name}</span><span className="text-sm text-muted-foreground">{p.patient_ref}</span></span>
                    <span className="hidden text-sm text-muted-foreground sm:block">Último acesso {new Date(p.last_seen_at).toLocaleDateString("pt-BR")}</span>
                    <span className="text-sm font-semibold text-primary">Pedir acesso</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      {modal && <RequestModal {...modal} onClose={() => setModal(null)} />}
    </div>
  );
}

function RequestModal({ patientId, name, onClose }: { patientId?: string; name?: string; onClose: () => void }) {
  const nav = useNavigate();
  const create = useServerFn(createAccessRequest);
  const poll = useServerFn(getAccessRequest);
  const [cats, setCats] = useState<ShareCategory[]>(["exames", "laudos"]);
  const [sigs, setSigs] = useState<ShareSignal[]>([]);
  const [profile, setProfile] = useState(true);
  const [period, setPeriod] = useState<number>(12);
  const [req, setReq] = useState<{ id: string; code: string; expires_at: string } | null>(null);
  const [state, setState] = useState("pending");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  useEffect(() => {
    if (!req) return;
    const t = setInterval(async () => {
      try {
        const r = await poll({ data: { id: req.id } });
        setState(r.status);
        if (r.status !== "pending") clearInterval(t);
        if (r.status === "authorized" && r.shareCode) nav({ to: "/medico", search: { code: r.shareCode } });
      } catch { /* tenta de novo */ }
    }, 3000);
    return () => clearInterval(t);
  }, [req, poll, nav]);

  const gerar = async () => {
    setBusy(true); setError("");
    try { setReq(await create({ data: { categories: cats, signals: sigs, includeProfile: profile, periodMonths: period, patientId } })); setState("pending"); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível gerar."); } finally { setBusy(false); }
  };
  const chip = (on: boolean) => `min-h-11 rounded-lg border px-3 text-sm font-medium ${on ? "border-primary bg-accent text-primary" : "bg-card"}`;

  return (
    <div role="dialog" aria-modal="true" aria-label="Solicitar acesso" className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-card p-6 shadow-soft">
        <div className="flex items-start justify-between"><div><h2 className="font-display text-xl font-semibold">{name ? `Pedir acesso — ${name}` : "Novo paciente"}</h2><p className="text-sm text-muted-foreground">Escolha só o que precisa para esta consulta.</p></div>
          <button onClick={onClose} aria-label="Fechar" className="grid h-11 w-11 place-items-center rounded-lg hover:bg-muted"><X className="h-5 w-5" aria-hidden /></button></div>
        {!req ? (<>
          <p className="mt-5 text-sm font-semibold">Informações</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" aria-pressed={profile} onClick={() => setProfile(!profile)} className={chip(profile)}>Perfil de saúde</button>
            {CATS.map(([k, l]) => <button key={k} type="button" aria-pressed={cats.includes(k)} onClick={() => setCats(toggle(cats, k))} className={chip(cats.includes(k))}>{l}</button>)}
          </div>
          <p className="mt-5 text-sm font-semibold">Dispositivos</p>
          <div className="mt-2 flex flex-wrap gap-2">{SIGS.map(([k, l]) => <button key={k} type="button" aria-pressed={sigs.includes(k)} onClick={() => setSigs(toggle(sigs, k))} className={chip(sigs.includes(k))}>{l}</button>)}</div>
          <p className="mt-5 text-sm font-semibold">Período dos documentos</p>
          <div className="mt-2 flex flex-wrap gap-2">{PERIOD_OPTIONS.map((p) => <button key={p} type="button" aria-pressed={period === p} onClick={() => setPeriod(p)} className={chip(period === p)}>{p === 60 ? "5 anos" : `${p} meses`}</button>)}</div>
          {error && <p role="alert" className="mt-4 rounded-lg bg-danger-soft p-3 text-sm">{error}</p>}
          <button onClick={gerar} disabled={busy} className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary font-semibold text-primary-foreground disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Gerar código</button>
        </>) : (
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">Peça ao paciente para abrir o VITA, tocar em <strong>Autorizar médico</strong> e digitar:</p>
            <p className="mt-4 font-display text-5xl font-bold tracking-[0.2em] text-primary" aria-live="polite">{formatRequestCode(req.code)}</p>
            <p className="mt-3 inline-flex items-center gap-1 text-sm text-muted-foreground"><Clock3 className="h-4 w-4" aria-hidden />Válido até {new Date(req.expires_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
            <p className="mt-6 flex items-center justify-center gap-2 rounded-lg bg-muted p-3 text-sm" role="status">
              {state === "pending" ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Aguardando autorização do paciente…</> : state === "authorized" ? "Autorizado! Abrindo histórico…" : state === "declined" ? "O paciente recusou a solicitação." : "O código expirou."}
            </p>
            {(state === "declined" || state === "expired") && <button onClick={() => setReq(null)} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 font-semibold"><RefreshCw className="h-4 w-4" aria-hidden />Gerar outro</button>}
          </div>
        )}
      </div>
    </div>
  );
}

function NoDoctor({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({ full_name: "", crm: "", uf: "SP", specialty: "" });
  const [error, setError] = useState("");
  return (
    <main className="grid min-h-screen place-items-center bg-background p-4">
      <form className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-soft" onSubmit={async (e) => {
        e.preventDefault(); setError("");
        const { error } = await supabase.from("doctor_profiles").insert({ ...f, crm: f.crm.replace(/\D/g, "") });
        if (error) setError("Confira o nome e o CRM (apenas números)."); else onDone();
      }}>
        <h1 className="font-display text-2xl font-bold">Complete seu cadastro profissional</h1>
        <p className="mt-1 text-sm text-muted-foreground">Esses dados aparecem para o paciente quando você pedir acesso.</p>
        <DoctorFields f={f} setF={setF} />
        {error && <p role="alert" className="mt-4 rounded-lg bg-danger-soft p-3 text-sm">{error}</p>}
        <button className="mt-5 min-h-12 w-full rounded-lg bg-primary font-semibold text-primary-foreground">Salvar</button>
        <Link to="/inicio" className="mt-3 block text-center text-sm text-muted-foreground underline">Sou paciente</Link>
      </form>
    </main>
  );
}

import { UFS } from "@/lib/clinic";
export function DoctorFields({ f, setF }: { f: { full_name: string; crm: string; uf: string; specialty: string }; setF: (v: { full_name: string; crm: string; uf: string; specialty: string }) => void }) {
  const input = "mt-1 min-h-11 w-full rounded-lg border bg-card px-3";
  return (
    <div className="mt-4 space-y-4">
      <label className="block"><span className="text-sm font-medium">Nome completo</span><input required minLength={2} value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} className={input} /></label>
      <div className="grid grid-cols-[1fr_6rem] gap-3">
        <label className="block"><span className="text-sm font-medium">CRM</span><input required inputMode="numeric" pattern="[0-9]{3,8}" value={f.crm} onChange={(e) => setF({ ...f, crm: e.target.value.replace(/\D/g, "").slice(0, 8) })} className={input} /></label>
        <label className="block"><span className="text-sm font-medium">UF</span><select value={f.uf} onChange={(e) => setF({ ...f, uf: e.target.value })} className={input}>{UFS.map((u) => <option key={u}>{u}</option>)}</select></label>
      </div>
      <label className="block"><span className="text-sm font-medium">Especialidade</span><input value={f.specialty} maxLength={80} onChange={(e) => setF({ ...f, specialty: e.target.value })} className={input} /></label>
    </div>
  );
}
