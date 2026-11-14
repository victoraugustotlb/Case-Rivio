import { useEffect, useState, type ReactNode } from "react";
import type { ShareCategory, ShareSignal } from "@/lib/share";

export const CATS: [ShareCategory, string][] = [["exames", "Exames"], ["laudos", "Laudos"], ["consultas", "Consultas"], ["receitas", "Receitas"], ["vacinas", "Vacinas"]];
export const SIGS: [ShareSignal, string][] = [["fc", "FC"], ["pressao", "PA"], ["glicose", "Glicose"], ["sono", "Sono"], ["spo2", "SpO₂"], ["passos", "Passos"]];
const catLabel = new Map<string, string>(CATS), sigLabel = new Map<string, string>(SIGS);

export function scopeText(s: { categories: string[]; signals: string[]; includeProfile: boolean; periodMonths: number }) {
  const parts = [...(s.includeProfile ? ["Perfil"] : []), ...s.categories.map((c) => catLabel.get(c) ?? c), ...s.signals.map((g) => sigLabel.get(g) ?? g)];
  return `${parts.join(", ") || "—"} · ${s.periodMonths === 60 ? "5 anos" : `${s.periodMonths} m`}`;
}

export function Countdown({ until }: { until: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const sec = Math.max(0, Math.floor((new Date(until).getTime() - now) / 1000));
  const txt = `${Math.floor(sec / 3600)}:${String(Math.floor((sec % 3600) / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
  return <span role="timer" className={`rounded px-1.5 py-0.5 font-mono text-xs tabular-nums ${sec < 600 ? "bg-warning-soft font-semibold text-warning" : "bg-muted"}`}>{txt}</span>;
}

export const fmtDT = (d: string | null) => (d ? new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");

export function ProPage({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-3">
        <div><h1 className="text-lg font-semibold tracking-tight">{title}</h1>{subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

export const th = "border-b bg-muted/50 px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";
export const td = "border-b px-2 py-1.5 align-top";

const STATUS: Record<string, [string, string]> = {
  pending: ["Pendente", "bg-warning-soft text-warning"], authorized: ["Autorizada", "bg-success-soft text-success"],
  declined: ["Recusada", "bg-danger-soft text-destructive"], expired: ["Expirada", "bg-muted text-muted-foreground"],
  ativo: ["Ativo", "bg-success-soft text-success"], expirado: ["Expirado", "bg-muted text-muted-foreground"],
  revogado: ["Revogado", "bg-danger-soft text-destructive"], recusado: ["Recusado", "bg-danger-soft text-destructive"],
  pending_patient: ["Pendente", "bg-warning-soft text-warning"], accepted: ["Aceito", "bg-success-soft text-success"], rejected: ["Recusado", "bg-danger-soft text-destructive"],
};
export function StatusTag({ s }: { s: string }) {
  const [l, c] = STATUS[s] ?? [s, "bg-muted"];
  return <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold ${c}`}>{l}</span>;
}

export function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Buscar por nome ou ID (AM-…)" aria-label="Buscar paciente" className="h-9 w-full rounded border bg-card px-2 text-sm sm:w-72" />;
}
