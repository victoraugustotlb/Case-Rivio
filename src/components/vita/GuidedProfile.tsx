import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Mic, MicOff, Minus, Plus } from "lucide-react";
import type { HealthProfile } from "@/lib/profile";

export const GUIDED_ORDER = ["alergias", "medicamentos", "tipo_sanguineo", "condicoes", "contato_emergencia", "altura", "peso", "nascimento"] as const;
export type GuidedStep = (typeof GUIDED_ORDER)[number];
type Save = (patch: Partial<HealthProfile>) => Promise<{ ok: true; profile: HealthProfile } | { ok: false; error: string }>;

const big = "min-h-14 rounded-2xl border-2 px-5 text-xl font-semibold";
const primary = `${big} border-primary bg-primary text-primary-foreground disabled:opacity-50`;
const ghost = `${big} bg-card hover:bg-muted`;

/** Ditado por voz em pt-BR quando o navegador tiver; sem suporte, o botão não aparece. */
function useDictation(onText: (t: string) => void) {
  const [supported, setSupported] = useState(false);
  const [on, setOn] = useState(false);
  const rec = useRef<any>(null);
  useEffect(() => {
    const w = window as any;
    setSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
    return () => rec.current?.stop?.();
  }, []);
  const toggle = () => {
    if (on) { rec.current?.stop(); return; }
    const w = window as any;
    const R = w.SpeechRecognition || w.webkitSpeechRecognition;
    const r = new R();
    r.lang = "pt-BR"; r.interimResults = false; r.maxAlternatives = 1;
    r.onresult = (e: any) => onText(String(e.results?.[0]?.[0]?.transcript ?? "").trim());
    r.onend = () => setOn(false);
    r.onerror = () => setOn(false);
    rec.current = r; setOn(true); r.start();
  };
  return { supported, on, toggle };
}

function TextAnswer({ id, label, value, onChange, inputMode, type = "text" }: { id: string; label: string; value: string; onChange: (v: string) => void; inputMode?: "text" | "tel" | "numeric"; type?: string }) {
  const d = useDictation((t) => onChange(value ? `${value} ${t}` : t));
  return (
    <div>
      <label htmlFor={id} className="block text-xl font-medium">{label}</label>
      <div className="mt-2 flex gap-2">
        <input id={id} type={type} inputMode={inputMode} value={value} onChange={(e) => onChange(e.target.value)} className="min-h-14 w-full min-w-0 rounded-2xl border-2 bg-background px-4 text-xl" />
        {d.supported && type === "text" && <button type="button" onClick={d.toggle} aria-pressed={d.on} className={`${ghost} shrink-0 px-4`} aria-label={d.on ? "Parar ditado" : "Ditar por voz"}>{d.on ? <MicOff className="h-6 w-6" aria-hidden /> : <Mic className="h-6 w-6" aria-hidden />}</button>}
      </div>
      {d.on && <p role="status" className="mt-2 text-lg text-brand-teal-strong">Ouvindo… fale agora.</p>}
    </div>
  );
}

function Stepper({ id, label, unit, value, step, min, max, onChange }: { id: string; label: string; unit: string; value: number | null; step: number; min: number; max: number; onChange: (v: number | null) => void }) {
  const bump = (d: number) => onChange(Math.min(max, Math.max(min, Math.round(((value ?? (unit === "cm" ? 165 : 70)) + d) * 10) / 10)));
  return (
    <div>
      <label htmlFor={id} className="block text-xl font-medium">{label} ({unit})</label>
      <div className="mt-2 flex items-center gap-3">
        <button type="button" onClick={() => bump(-step)} className={`${ghost} grid w-16 place-items-center px-0`} aria-label={`Diminuir ${step} ${unit}`}><Minus className="h-7 w-7" aria-hidden /></button>
        <input id={id} inputMode="decimal" value={value ?? ""} onChange={(e) => { const n = Number(e.target.value.replace(",", ".")); onChange(e.target.value === "" ? null : Number.isFinite(n) ? n : value); }}
          className="min-h-16 w-full min-w-0 rounded-2xl border-2 bg-background text-center font-display text-4xl font-bold tabular-nums" />
        <button type="button" onClick={() => bump(step)} className={`${ghost} grid w-16 place-items-center px-0`} aria-label={`Aumentar ${step} ${unit}`}><Plus className="h-7 w-7" aria-hidden /></button>
      </div>
    </div>
  );
}

function Toggles({ options, selected, onToggle }: { options: string[]; selected: string[]; onToggle: (o: string) => void }) {
  return (
    <div className="flex flex-wrap gap-3">
      {options.map((o) => {
        const on = selected.some((s) => s.toLowerCase() === o.toLowerCase());
        return <button key={o} type="button" aria-pressed={on} onClick={() => onToggle(o)} className={`${big} inline-flex items-center gap-2 ${on ? "border-primary bg-primary-soft text-primary" : "bg-card"}`}>{on && <Check className="h-5 w-5" aria-hidden />}{o}</button>;
      })}
    </div>
  );
}

const splitList = (t: string) => t.split(/\n|;|,/).map((x) => x.trim()).filter(Boolean);

export function GuidedProfile({ profile: initial, save, startAt, whose = "você", onFinish }: { profile: HealthProfile; save: Save; startAt?: GuidedStep; whose?: string; onFinish: () => void }) {
  const [profile, setProfile] = useState(initial);
  const [i, setI] = useState(Math.max(0, startAt ? GUIDED_ORDER.indexOf(startAt) : 0));
  const [draft, setDraft] = useState("");
  const [extra, setExtra] = useState({ dose: "", parentesco: "", telefone: "", d: "", m: "", y: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const step = GUIDED_ORDER[i] ?? "alergias";
  const you = whose === "você";
  const next = () => { setDraft(""); setExtra({ dose: "", parentesco: "", telefone: "", d: "", m: "", y: "" }); setError(""); if (i >= GUIDED_ORDER.length - 1) onFinish(); else setI(i + 1); };
  const answer = async (patch: Partial<HealthProfile>, advance = true) => {
    setBusy(true); setError("");
    try {
      const r = await save(patch);
      if (!r.ok) { setError(r.error); return; }
      setProfile(r.profile);
      if (advance) next();
    } catch { setError("Não foi possível salvar agora. Tente de novo."); } finally { setBusy(false); }
  };
  const none = (f: HealthProfile["confirmed_none"][number]) => answer({ confirmed_none: Array.from(new Set([...profile.confirmed_none, f])) });
  const toggleLine = (key: "allergies" | "conditions", o: string) => {
    const list = splitList(profile[key]);
    const has = list.some((x) => x.toLowerCase() === o.toLowerCase());
    void answer({ [key]: (has ? list.filter((x) => x.toLowerCase() !== o.toLowerCase()) : [...list, o]).join("\n") } as Partial<HealthProfile>, false);
  };
  const addDraftLine = (key: "allergies" | "conditions") => draft.trim() ? answer({ [key]: [...splitList(profile[key]), draft.trim()].join("\n") } as Partial<HealthProfile>) : Promise.resolve(next());

  const q: Record<GuidedStep, { title: string; body: React.ReactNode }> = {
    alergias: {
      title: you ? "Você tem alergia a algum remédio ou alimento?" : `${whose} tem alergia a algum remédio ou alimento?`,
      body: <>
        <p className="text-lg text-muted-foreground">Toque nos que valem, ou escreva outro.</p>
        <Toggles options={["Dipirona", "Penicilina", "Frutos do mar", "Látex"]} selected={splitList(profile.allergies)} onToggle={(o) => toggleLine("allergies", o)} />
        <TextAnswer id="g-alergia" label="Outra alergia" value={draft} onChange={setDraft} />
        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" disabled={busy} onClick={() => void addDraftLine("allergies")} className={primary}>Continuar</button>
          <button type="button" disabled={busy} onClick={() => void none("alergias")} className={ghost}>Nenhuma que eu saiba</button>
        </div>
      </>,
    },
    medicamentos: {
      title: you ? "Você toma algum remédio todo dia ou com frequência?" : `${whose} toma algum remédio com frequência?`,
      body: <>
        {profile.medications.length > 0 && <ul className="space-y-2 text-xl">{profile.medications.map((m, k) => <li key={k} className="flex items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3"><span>{[m.name, m.dose].filter(Boolean).join(" · ")}</span><button type="button" onClick={() => void answer({ medications: profile.medications.filter((_, j) => j !== k) }, false)} className="min-h-14 rounded-xl px-3 text-lg font-medium text-destructive">Tirar</button></li>)}</ul>}
        <TextAnswer id="g-med" label="Nome do remédio" value={draft} onChange={setDraft} />
        <TextAnswer id="g-dose" label="Dose (se souber)" value={extra.dose} onChange={(v) => setExtra({ ...extra, dose: v })} />
        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" disabled={busy || !draft.trim()} onClick={() => { void answer({ medications: [...profile.medications, { name: draft.trim(), dose: extra.dose.trim(), frequency: "" }] }, false).then(() => { setDraft(""); setExtra({ ...extra, dose: "" }); }); }} className={ghost}>Adicionar outro</button>
          <button type="button" disabled={busy} onClick={() => draft.trim() ? void answer({ medications: [...profile.medications, { name: draft.trim(), dose: extra.dose.trim(), frequency: "" }] }) : next()} className={primary}>Continuar</button>
        </div>
        <button type="button" disabled={busy} onClick={() => void none("medicamentos")} className={`${ghost} w-full`}>Não tomo nenhum remédio</button>
      </>,
    },
    tipo_sanguineo: {
      title: you ? "Qual é o seu tipo sanguíneo?" : `Qual é o tipo sanguíneo de ${whose}?`,
      body: <div className="grid grid-cols-4 gap-3">{(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const).map((b) => <button key={b} type="button" aria-pressed={profile.blood_type === b} disabled={busy} onClick={() => void answer({ blood_type: b })} className={`${big} px-0 font-display text-2xl ${profile.blood_type === b ? "border-primary bg-primary-soft text-primary" : "bg-card"}`}>{b}</button>)}</div>,
    },
    condicoes: {
      title: you ? "Você tem alguma doença ou condição de saúde?" : `${whose} tem alguma doença ou condição de saúde?`,
      body: <>
        <p className="text-lg text-muted-foreground">Por exemplo, as que o médico já disse que você tem.</p>
        <Toggles options={["Pressão alta", "Diabetes", "Asma", "Colesterol alto"]} selected={splitList(profile.conditions)} onToggle={(o) => toggleLine("conditions", o)} />
        <TextAnswer id="g-cond" label="Outra condição" value={draft} onChange={setDraft} />
        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" disabled={busy} onClick={() => void addDraftLine("conditions")} className={primary}>Continuar</button>
          <button type="button" disabled={busy} onClick={() => void none("condicoes")} className={ghost}>Nenhuma que eu saiba</button>
        </div>
      </>,
    },
    contato_emergencia: {
      title: "Quem devemos chamar numa emergência?",
      body: <>
        {profile.emergency_contacts.length > 0 && <ul className="space-y-2 text-xl">{profile.emergency_contacts.map((c, k) => <li key={k} className="rounded-2xl border bg-card px-4 py-3">{c.nome}{c.parentesco ? ` (${c.parentesco})` : ""} · {c.telefone}</li>)}</ul>}
        <TextAnswer id="g-cnome" label="Nome" value={draft} onChange={setDraft} />
        <p className="text-xl font-medium">Quem é?</p>
        <div className="flex flex-wrap gap-3">{["Filho(a)", "Cônjuge", "Mãe ou pai", "Irmão(ã)", "Amigo(a)"].map((p) => <button key={p} type="button" aria-pressed={extra.parentesco === p} onClick={() => setExtra({ ...extra, parentesco: p })} className={`${big} ${extra.parentesco === p ? "border-primary bg-primary-soft text-primary" : "bg-card"}`}>{p}</button>)}</div>
        <TextAnswer id="g-ctel" label="Telefone com DDD" type="tel" inputMode="tel" value={extra.telefone} onChange={(v) => setExtra({ ...extra, telefone: v })} />
        <button type="button" disabled={busy || !draft.trim() || extra.telefone.replace(/\D/g, "").length < 8 || profile.emergency_contacts.length >= 3} onClick={() => void answer({ emergency_contacts: [...profile.emergency_contacts, { nome: draft.trim(), parentesco: extra.parentesco, telefone: extra.telefone.trim() }] })} className={`${primary} w-full`}>Salvar contato</button>
      </>,
    },
    altura: {
      title: you ? "Qual é a sua altura?" : `Qual é a altura de ${whose}?`,
      body: <><Stepper id="g-alt" label="Altura" unit="cm" value={profile.height_cm} step={1} min={30} max={250} onChange={(v) => setProfile({ ...profile, height_cm: v })} />
        <button type="button" disabled={busy || !profile.height_cm} onClick={() => void answer({ height_cm: profile.height_cm })} className={`${primary} w-full`}>Salvar e continuar</button></>,
    },
    peso: {
      title: you ? "Qual é o seu peso?" : `Qual é o peso de ${whose}?`,
      body: <><Stepper id="g-peso" label="Peso" unit="kg" value={profile.weight_kg} step={0.5} min={2} max={700} onChange={(v) => setProfile({ ...profile, weight_kg: v })} />
        <button type="button" disabled={busy || !profile.weight_kg} onClick={() => void answer({ weight_kg: profile.weight_kg })} className={`${primary} w-full`}>Salvar e continuar</button></>,
    },
    nascimento: {
      title: you ? "Quando você nasceu?" : `Quando ${whose} nasceu?`,
      body: <>
        <div className="grid grid-cols-3 gap-3">
          {([["d", "Dia", 2], ["m", "Mês", 2], ["y", "Ano", 4]] as const).map(([k, l, n]) => <div key={k}><label htmlFor={`g-${k}`} className="block text-xl font-medium">{l}</label><input id={`g-${k}`} inputMode="numeric" maxLength={n} value={extra[k]} onChange={(e) => setExtra({ ...extra, [k]: e.target.value.replace(/\D/g, "") })} className="mt-2 min-h-16 w-full rounded-2xl border-2 bg-background text-center font-display text-3xl font-bold" /></div>)}
        </div>
        <button type="button" disabled={busy || extra.y.length !== 4 || !extra.m || !extra.d} onClick={() => void answer({ birth_date: `${extra.y}-${extra.m.padStart(2, "0")}-${extra.d.padStart(2, "0")}` })} className={`${primary} w-full`}>Salvar</button>
      </>,
    },
  };
  const cur = q[step];
  return (
    <div className="mx-auto max-w-2xl text-xl">
      <div className="flex items-center justify-between gap-3">
        <button type="button" disabled={i === 0} onClick={() => { setError(""); setI(i - 1); }} className={`${ghost} inline-flex items-center gap-2 disabled:opacity-40`}><ArrowLeft className="h-5 w-5" aria-hidden />Voltar</button>
        <p className="text-lg font-semibold" aria-live="polite">Pergunta {i + 1} de {GUIDED_ORDER.length}</p>
      </div>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-muted" aria-hidden><div className="h-full bg-primary" style={{ width: `${((i + 1) / GUIDED_ORDER.length) * 100}%` }} /></div>
      <h1 className="mt-8 font-display text-3xl font-bold leading-tight">{cur.title}</h1>
      <div className="mt-6 space-y-5">{cur.body}</div>
      {error && <p role="alert" className="mt-5 rounded-2xl bg-danger-soft p-4 text-lg">{error}</p>}
      <div className="mt-8 grid grid-cols-2 gap-3 border-t pt-6">
        <button type="button" onClick={next} className={ghost}>Não sei</button>
        <button type="button" onClick={next} className={ghost}>Pular</button>
      </div>
      <p className="mt-4 text-base text-muted-foreground">Cada resposta é salva na hora. Você pode parar quando quiser.</p>
    </div>
  );
}
