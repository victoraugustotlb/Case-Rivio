import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Droplet, Gauge, HeartPulse, Loader2, Scale, Thermometer, Wind } from "lucide-react";
import { MANUAL_KINDS, type ManualKind } from "@/lib/wearables";
import { recordManualReading } from "@/lib/wearables.functions";

const ICON: Record<ManualKind, typeof Gauge> = { pressao: Gauge, glicose: Droplet, batimentos: HeartPulse, oxigenio: Wind, peso: Scale, temperatura: Thermometer };

/** Anotar uma medição à mão: funciona para qualquer pessoa, com qualquer aparelho, sem instalar nada. */
export function ManualReading() {
  const [kind, setKind] = useState<ManualKind | null>(null);
  const [vals, setVals] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const save = useServerFn(recordManualReading);
  const qc = useQueryClient();
  const def = kind ? MANUAL_KINDS[kind] : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!kind || !def) return;
    const nums = vals.map((v) => Number(v.replace(",", ".")));
    if (nums.length !== def.campos.length || nums.some((n) => !Number.isFinite(n) || n <= 0)) { setMsg({ ok: false, text: "Preencha todos os números." }); return; }
    setBusy(true); setMsg(null);
    try {
      const r = await save({ data: { kind, values: nums, measured_at: new Date().toISOString() } });
      if (r.ok) {
        setMsg({ ok: true, text: "Pronto, anotado." }); setVals([]);
        void qc.invalidateQueries({ queryKey: ["wearable-readings"] }); void qc.invalidateQueries({ queryKey: ["wearable-connections"] });
      } else setMsg({ ok: false, text: r.error === "fora_da_faixa" ? "Esse número parece errado. Confira no aparelho e tente de novo." : "Preencha todos os números." });
    } catch { setMsg({ ok: false, text: "Não foi possível salvar agora. Tente de novo." }); } finally { setBusy(false); }
  }

  return (
    <div className="rounded-2xl border bg-card p-5">
      <p className="font-semibold">O que você mediu?</p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {(Object.keys(MANUAL_KINDS) as ManualKind[]).map((k) => {
          const Icon = ICON[k]; const on = kind === k;
          return (
            <button key={k} type="button" aria-pressed={on} onClick={() => { setKind(k); setVals([]); setMsg(null); }}
              className={`flex min-h-14 items-center gap-2 rounded-xl border px-3 text-left text-sm font-semibold ${on ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent"}`}>
              <Icon className="h-5 w-5 shrink-0" aria-hidden />{MANUAL_KINDS[k].titulo}
            </button>
          );
        })}
      </div>
      {def && kind && (
        <form onSubmit={submit} className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">{def.dica}</p>
          {def.campos.map((c, i) => (
            <label key={c.metric} className="block text-sm font-medium">{c.rotulo}
              <input inputMode="decimal" autoComplete="off" value={vals[i] ?? ""} onChange={(e) => setVals((v) => { const n = [...v]; n[i] = e.target.value; return n; })}
                className="mt-1 min-h-14 w-full rounded-xl border bg-card px-4 text-2xl font-semibold" />
            </label>
          ))}
          <button type="submit" disabled={busy} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-60 sm:w-auto">
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Salvar medição
          </button>
        </form>
      )}
      {msg && <p role={msg.ok ? "status" : "alert"} className={`mt-3 flex items-center gap-2 text-sm font-medium ${msg.ok ? "text-success" : "text-destructive"}`}>{msg.ok && <CheckCircle2 className="h-4 w-4" aria-hidden />}{msg.text}</p>}
    </div>
  );
}
