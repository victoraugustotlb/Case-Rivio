import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { ESSENTIAL_FIELDS, ESSENTIAL_LABELS, type EssentialField } from "@/lib/profile-completion";
import { patientSettingsQuery } from "@/lib/patient-settings-query";
import { DEFAULT_SETTINGS, savePatientSettings, type PatientSettings } from "@/lib/profile.functions";

/** Configurações do paciente: ficha essencial por padrão, texto grande e modo simples. */
export function ProfileSettings() {
  const qc = useQueryClient();
  const q = useQuery(patientSettingsQuery);
  const save = useServerFn(savePatientSettings);
  const m = useMutation({
    mutationFn: (p: Partial<PatientSettings>) => save({ data: p }),
    onSuccess: (merged) => qc.setQueryData(patientSettingsQuery.queryKey, merged),
  });
  const s = q.data ?? DEFAULT_SETTINGS;
  const toggleField = (f: EssentialField, on: boolean) => m.mutate({ essentials_fields: on ? [...new Set([...s.essentials_fields, f])] : s.essentials_fields.filter((x) => x !== f) });
  const row = (id: string, titulo: string, texto: string, checked: boolean, onChange: (v: boolean) => void) => (
    <div className="flex items-start justify-between gap-4 py-3">
      <label htmlFor={id} className="min-w-0 flex-1"><span className="block font-semibold">{titulo}</span><span className="block text-sm text-muted-foreground">{texto}</span></label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={m.isPending} />
    </div>
  );
  return (
    <section aria-labelledby="config" className="rounded-2xl border bg-card p-5">
      <h2 id="config" className="font-display text-xl font-bold">Configurações</h2>
      <div className="mt-2 divide-y">
        {row("cfg-ficha", "Incluir minha ficha essencial em novos códigos e autorizações", "Já vem marcada. Você pode desmarcar a qualquer momento, em cada código. Só o médico com o código vê.", s.default_share_essentials, (v) => m.mutate({ default_share_essentials: v }))}
        {row("cfg-grande", "Texto grande", "Aumenta as letras e os botões em todo o aplicativo.", s.large_text, (v) => m.mutate({ large_text: v }))}
        {row("cfg-simples", "Modo simples", "Perguntas do perfil uma de cada vez, com botões grandes.", s.guided_mode, (v) => m.mutate({ guided_mode: v }))}
      </div>
      <fieldset className="mt-4">
        <legend className="font-semibold">O que a ficha essencial inclui</legend>
        <p className="text-sm text-muted-foreground">Hábitos e histórico da família ficam de fora; você só os compartilha se marcar em cada código.</p>
        <div className="mt-2 grid gap-1 sm:grid-cols-2">
          {ESSENTIAL_FIELDS.map((f) => (
            <label key={f} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={s.essentials_fields.includes(f)} onChange={(e) => toggleField(f, e.target.checked)} disabled={m.isPending} />{ESSENTIAL_LABELS[f]}</label>
          ))}
        </div>
      </fieldset>
      {m.isError && <p role="alert" className="mt-2 text-sm text-destructive">Não foi possível salvar. Tente de novo.</p>}
    </section>
  );
}
