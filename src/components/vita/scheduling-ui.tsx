import { BadgeCheck, CircleAlert, FlaskConical, Video } from "lucide-react";
import type { ReactNode } from "react";

export const TZ = "America/Sao_Paulo";
export const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: TZ });
export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
export const fmtFull = (iso: string) => new Date(iso).toLocaleString("pt-BR", { weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit", timeZone: TZ });
export const brl = (v: number | null) => (v == null ? "não informado" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
export const kindLabel: Record<string, string> = { medico: "Médico(a)", clinica: "Clínica", laboratorio: "Laboratório" };

export function DemoTag() {
  return <span className="inline-flex items-center gap-1 rounded-full border border-warning bg-warning-soft px-2 py-0.5 text-xs font-medium"><FlaskConical className="h-3 w-3" aria-hidden />Dados de demonstração</span>;
}

export function PlanBadge({ accepts, planName, price }: { accepts: boolean; planName: string | null; price: number | null }) {
  if (accepts && planName) return <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-1 text-xs font-medium text-success"><BadgeCheck className="h-4 w-4" aria-hidden />Aceita {planName}</span>;
  return <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs font-medium"><CircleAlert className="h-4 w-4" aria-hidden />{planName ? "Não aceita seu plano. " : ""}Particular: {brl(price)}</span>;
}

export function TeleTag() {
  return <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-1 text-xs font-medium text-primary"><Video className="h-4 w-4" aria-hidden />Telemedicina disponível</span>;
}

export function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: { v: T; l: ReactNode }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
      {options.map((o) => (
        <button key={o.v} type="button" role="radio" aria-checked={value === o.v} onClick={() => onChange(o.v)}
          className={`min-h-10 flex-1 rounded-md px-3 text-sm font-medium ${value === o.v ? "bg-card text-primary shadow-soft" : "text-muted-foreground hover:text-foreground"}`}>{o.l}</button>
      ))}
    </div>
  );
}
export const dayKeyLabel = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", timeZone: TZ });
