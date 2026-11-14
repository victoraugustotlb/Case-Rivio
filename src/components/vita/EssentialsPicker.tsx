import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ClipboardCheck, SlidersHorizontal } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ESSENTIAL_FIELDS, ESSENTIAL_LABELS, type EssentialField } from "@/lib/profile-completion";
import { DEFAULT_SHARE_ESSENTIALS } from "@/lib/share";
import { savePatientSettings } from "@/lib/profile.functions";
import { patientSettingsQuery } from "@/lib/patient-settings-query";

export type EssentialsChoice = { include: boolean; fields: EssentialField[] };
export const essentialsSummary = (fields: readonly EssentialField[]) => fields.filter((f) => f !== "imc").map((f) => ESSENTIAL_LABELS[f].toLowerCase()).join(", ").replace(/^./, (c) => c.toUpperCase());

/** Estado da ficha essencial para um novo código: começa conforme a configuração do paciente. */
export function useEssentialsChoice(): [EssentialsChoice, (c: EssentialsChoice) => void] {
  const settings = useQuery(patientSettingsQuery);
  const [choice, setChoice] = useState<EssentialsChoice | null>(null);
  useEffect(() => {
    if (choice || !settings.data) return;
    setChoice({ include: settings.data.default_share_essentials ?? DEFAULT_SHARE_ESSENTIALS, fields: settings.data.essentials_fields as EssentialField[] });
  }, [settings.data, choice]);
  return [choice ?? { include: settings.isError ? DEFAULT_SHARE_ESSENTIALS : false, fields: [...ESSENTIAL_FIELDS] }, setChoice];
}

export function EssentialsPicker({ value, onChange, title = "Ficha essencial" }: { value: EssentialsChoice; onChange: (c: EssentialsChoice) => void; title?: string }) {
  const [open, setOpen] = useState(false);
  const save = useServerFn(savePatientSettings);
  const qc = useQueryClient();
  const setFields = (fields: EssentialField[]) => {
    onChange({ ...value, fields });
    void save({ data: { essentials_fields: fields } }).then(() => qc.invalidateQueries({ queryKey: patientSettingsQuery.queryKey })).catch(() => undefined);
  };
  const on = value.include && value.fields.length > 0;
  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary"><ClipboardCheck className="h-5 w-5" aria-hidden /></span>
        <div className="min-w-0">
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{value.fields.length ? essentialsSummary(value.fields) : "Nenhum dado escolhido."}</p>
        </div>
      </div>
      <button type="button" role="checkbox" aria-checked={on} onClick={() => onChange({ ...value, include: !value.include })}
        className={`mt-4 flex min-h-12 w-full items-center gap-3 rounded-lg border px-4 text-left text-sm font-medium ${on ? "border-primary bg-primary-soft text-primary" : "bg-card hover:bg-muted"}`}>
        <span className={`grid h-5 w-5 shrink-0 place-items-center rounded border ${on ? "border-primary bg-primary text-primary-foreground" : ""}`}>{on && <Check className="h-3.5 w-3.5" aria-hidden />}</span>
        {on ? "Incluir a ficha essencial neste código" : "Não incluir a ficha essencial"}
      </button>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Você pode desmarcar a qualquer momento. Só o médico com este código vê.</p>
        <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-brand-teal-strong underline"><SlidersHorizontal className="h-4 w-4" aria-hidden />Escolher quais dados</button>
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="overflow-y-auto">
          <SheetHeader><SheetTitle>Quais dados da ficha</SheetTitle><SheetDescription>Sua escolha fica salva para os próximos códigos. Códigos já criados não mudam.</SheetDescription></SheetHeader>
          <ul className="mt-4 space-y-2 px-4 pb-6">
            {ESSENTIAL_FIELDS.map((f) => {
              const checked = value.fields.includes(f);
              return (
                <li key={f}>
                  <button type="button" role="switch" aria-checked={checked} onClick={() => setFields(checked ? value.fields.filter((x) => x !== f) : ESSENTIAL_FIELDS.filter((x) => x === f || value.fields.includes(x)))}
                    className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border px-3 text-left text-sm font-medium hover:bg-muted">
                    <span>{ESSENTIAL_LABELS[f]}</span>
                    <span className="text-xs text-muted-foreground">{checked ? "Incluído" : "Fora"}</span>
                    <span aria-hidden className={`relative h-6 w-11 shrink-0 rounded-full ${checked ? "bg-primary" : "bg-muted-foreground/30"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-card ${checked ? "right-1" : "left-1"}`} /></span>
                  </button>
                </li>
              );
            })}
          </ul>
        </SheetContent>
      </Sheet>
    </section>
  );
}
