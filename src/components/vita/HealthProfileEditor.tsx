import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowRight, Check, ClipboardList, HeartPulse, Loader2, Pill, Plus, Ruler, Save, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ageFromBirthDate, emptyProfile, profileSchema, type HealthProfile } from "@/lib/profile";
import { saveHealthProfile } from "@/lib/profile.functions";
import { healthProfileQuery } from "@/lib/profile-query";

const steps = [
  { name: "Sobre você", icon: UserRound },
  { name: "Medicamentos", icon: Pill },
  { name: "Histórico", icon: HeartPulse },
  { name: "Hábitos", icon: ClipboardList },
];

export function HealthProfileEditor({ initial, accountName }: { initial: HealthProfile | null; accountName: string }) {
  const [profile, setProfile] = useState<HealthProfile>(initial ?? { ...emptyProfile, full_name: accountName });
  const [wizard, setWizard] = useState(!initial?.questionnaire_completed);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const save = useServerFn(saveHealthProfile);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const defer = async () => {
    setBusy(true); setError("");
    try {
      await save({ data: initial ?? { ...emptyProfile, full_name: accountName } });
      await queryClient.invalidateQueries({ queryKey: healthProfileQuery.queryKey });
      await navigate({ to: "/inicio", replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível continuar. Tente novamente.");
    } finally { setBusy(false); }
  };
  const update = <K extends keyof HealthProfile>(key: K, value: HealthProfile[K]) => {
    setProfile((previous) => ({ ...previous, [key]: value }));
    setSaved(false);
    setError("");
  };
  const persist = async (complete: boolean) => {
    const parsed = profileSchema.safeParse({ ...profile, questionnaire_completed: complete || profile.questionnaire_completed });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Confira as informações."); return; }
    setBusy(true); setError(""); setSaved(false);
    try {
      await save({ data: parsed.data });
      setProfile(parsed.data);
      await queryClient.invalidateQueries({ queryKey: healthProfileQuery.queryKey });
      setSaved(true); setWizard(false);
      if (complete) await navigate({ to: "/inicio", replace: true });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível salvar. Tente novamente."); }
    finally { setBusy(false); }
  };
  const next = () => {
    const parsed = profileSchema.safeParse(profile);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Confira as informações."); return; }
    setError(""); setStep((previous) => Math.min(previous + 1, 3));
  };
  const age = ageFromBirthDate(profile.birth_date);
  const visible = (index: number) => !wizard || step === index;
  const field = (key: "allergies" | "conditions" | "surgeries" | "family_history", label: string) => (
    <div className="space-y-2"><Label htmlFor={key}>{label}</Label><Textarea id={key} value={profile[key]} maxLength={2000} onChange={(event) => update(key, event.target.value)} className="min-h-24" /></div>
  );
  const choice = (key: "smoking" | "alcohol" | "activity", label: string, values: readonly string[]) => (
    <div className="space-y-2"><Label htmlFor={key}>{label}</Label>
      <Select value={profile[key] || "unanswered"} onValueChange={(value) => update(key, (value === "unanswered" ? "" : value) as HealthProfile[typeof key])}>
        <SelectTrigger id={key} className="min-h-11"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="unanswered">Prefiro não informar</SelectItem>{values.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary"><UserRound className="h-6 w-6" aria-hidden /></span>
          <div className="min-w-0"><h2 className="font-display text-xl font-semibold">{wizard ? "Vamos conhecer seu histórico" : profile.full_name || "Seu perfil de saúde"}</h2><p className="mt-1 text-sm text-muted-foreground">{wizard ? "Questionário inicial · Todas as respostas são opcionais" : "Informações declaradas por você"}</p></div>
        </div>
        {!wizard && <Button variant="outline" className="min-h-11" onClick={() => { setWizard(true); setStep(0); setSaved(false); }}><ClipboardList />Revisar questionário</Button>}
      </div>

      {wizard && <ol aria-label="Etapas do questionário" className="my-6 grid grid-cols-4 gap-2">
        {steps.map(({ name, icon: Icon }, index) => <li key={name} aria-current={index === step ? "step" : undefined} className={`min-w-0 border-b-2 pb-3 ${index <= step ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>
          <span className="mb-2 flex items-center gap-2 text-sm font-semibold">{index < step ? <Check className="h-4 w-4" aria-hidden /> : <Icon className="h-4 w-4" aria-hidden />}<span>{index + 1}</span></span><span className="block break-words text-xs sm:text-sm">{name}</span>
        </li>)}
      </ol>}

      <form onSubmit={(event) => { event.preventDefault(); if (wizard && step < 3) next(); else void persist(wizard); }} className="space-y-8 pt-6">
        {visible(0) && <section aria-labelledby="personal-heading" className="space-y-5">
          <h3 id="personal-heading" className="flex items-center gap-2 font-display text-xl font-semibold"><Ruler className="h-5 w-5 text-primary" aria-hidden />Sobre você</h3>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="full_name">Nome completo</Label><Input id="full_name" autoComplete="name" maxLength={150} value={profile.full_name} onChange={(event) => update("full_name", event.target.value)} className="min-h-11" /></div>
            <div className="space-y-2"><Label htmlFor="birth_date">Data de nascimento</Label><Input id="birth_date" type="date" value={profile.birth_date ?? ""} onChange={(event) => update("birth_date", event.target.value || null)} className="min-h-11" /></div>
            <div className="space-y-2"><Label htmlFor="age">Idade</Label><Input id="age" readOnly value={age === null ? "Não informada" : `${age} anos`} className="min-h-11 bg-muted" /></div>
            <div className="space-y-2"><Label htmlFor="height_cm">Altura (cm)</Label><Input id="height_cm" type="number" inputMode="decimal" min="0.1" max="300" step="0.1" value={profile.height_cm ?? ""} onChange={(event) => update("height_cm", event.target.value === "" ? null : Number(event.target.value))} className="min-h-11" /></div>
            <div className="space-y-2"><Label htmlFor="weight_kg">Peso (kg)</Label><Input id="weight_kg" type="number" inputMode="decimal" min="0.1" max="700" step="0.1" value={profile.weight_kg ?? ""} onChange={(event) => update("weight_kg", event.target.value === "" ? null : Number(event.target.value))} className="min-h-11" /></div>
          </div>
        </section>}

        {visible(1) && <section aria-labelledby="medication-heading" className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><h3 id="medication-heading" className="flex items-center gap-2 font-display text-xl font-semibold"><Pill className="h-5 w-5 text-primary" aria-hidden />Medicamentos em uso</h3>
            <Button type="button" variant="outline" className="min-h-11" disabled={profile.medications.length >= 50} onClick={() => update("medications", [...profile.medications, { name: "", dose: "", frequency: "" }])}><Plus />Adicionar medicamento</Button></div>
          {profile.medications.length === 0 && <p className="border-l-2 border-border py-3 pl-4 text-sm text-muted-foreground">Nenhum medicamento informado.</p>}
          {profile.medications.map((medication, index) => <div key={index} className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,.7fr)_minmax(0,1fr)_auto]">
            {([['name', 'Medicamento'], ['dose', 'Dose'], ['frequency', 'Frequência']] as const).map(([key, label]) => <div key={key} className="min-w-0 space-y-2"><Label htmlFor={`med-${index}-${key}`}>{label}</Label><Input id={`med-${index}-${key}`} maxLength={key === "dose" ? 100 : 150} value={medication[key]} onChange={(event) => update("medications", profile.medications.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: event.target.value } : item))} className="min-h-11" /></div>)}
            <Button type="button" variant="ghost" size="icon" className="h-11 w-11 self-end text-destructive" aria-label={`Remover medicamento ${index + 1}`} title="Remover medicamento" onClick={() => update("medications", profile.medications.filter((_, itemIndex) => itemIndex !== index))}><Trash2 /></Button>
          </div>)}
        </section>}

        {visible(2) && <section aria-labelledby="history-heading" className="space-y-5">
          <h3 id="history-heading" className="flex items-center gap-2 font-display text-xl font-semibold"><HeartPulse className="h-5 w-5 text-primary" aria-hidden />Histórico de saúde</h3>
          <div className="grid gap-5 sm:grid-cols-2">{field("allergies", "Alergias conhecidas")}{field("conditions", "Condições de saúde")}{field("surgeries", "Cirurgias e internações anteriores")}{field("family_history", "Histórico de saúde da família")}</div>
        </section>}

        {visible(3) && <section aria-labelledby="habits-heading" className="space-y-5">
          <h3 id="habits-heading" className="flex items-center gap-2 font-display text-xl font-semibold"><ClipboardList className="h-5 w-5 text-primary" aria-hidden />Hábitos</h3>
          <div className="grid gap-5 sm:grid-cols-2">{choice("smoking", "Você fuma?", ["Nunca", "Já parei", "Atualmente"])}{choice("alcohol", "Consumo de álcool", ["Não consumo", "Ocasionalmente", "Regularmente"])}{choice("activity", "Atividade física", ["Não pratico", "1–2 dias por semana", "3–4 dias por semana", "5 ou mais dias por semana"])}</div>
        </section>}

        <p className="flex items-start gap-2 text-sm text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />Estas informações são privadas e só aparecem no VITA Clínico quando você marca “Perfil de saúde” ao gerar um código.</p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {saved && <p role="status" className="flex items-center gap-2 text-sm font-medium text-success"><Check className="h-4 w-4" />Perfil salvo com sucesso.</p>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
          {wizard ? <div className="flex flex-wrap gap-2">{step > 0 && <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={() => { setStep(step - 1); setError(""); }}><ArrowLeft />Voltar</Button>}<Button type="button" variant="ghost" className="min-h-11" disabled={busy} onClick={() => void defer()}>Preencher depois</Button></div> : <span />}
          <Button type="submit" className="min-h-11" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : wizard && step < 3 ? <ArrowRight /> : <Save />}{busy ? "Salvando…" : wizard ? step < 3 ? "Continuar" : "Concluir e salvar" : "Salvar alterações"}</Button>
        </div>
      </form>
    </div>
  );
}