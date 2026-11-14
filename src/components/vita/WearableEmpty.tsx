import { Link } from "@tanstack/react-router";
import { Bluetooth, KeyRound, Watch } from "lucide-react";

/** Sem dispositivo: só opções de conexão, nunca números. */
export function WearableEmpty({ compact }: { compact?: boolean }) {
  return (
    <div className="rounded-2xl border border-dashed bg-card p-6">
      <p className="font-display text-lg font-bold">Nenhum dispositivo conectado</p>
      <p className="mt-1 text-sm text-muted-foreground">Conecte um relógio, anel ou cinta para ver frequência cardíaca, sono, passos e outros sinais aqui.</p>
      <div className={`mt-4 grid gap-2 ${compact ? "sm:grid-cols-3" : "sm:grid-cols-3"}`}>
        <Link to="/dispositivos" className="flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm font-medium hover:bg-accent"><Watch className="h-4 w-4 text-brand-teal-strong" aria-hidden />Relógio ou anel</Link>
        <Link to="/dispositivos" hash="bluetooth" className="flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm font-medium hover:bg-accent"><Bluetooth className="h-4 w-4 text-brand-teal-strong" aria-hidden />Cinta por Bluetooth</Link>
        <Link to="/dispositivos/api" className="flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm font-medium hover:bg-accent"><KeyRound className="h-4 w-4 text-brand-teal-strong" aria-hidden />Outro aplicativo</Link>
      </div>
    </div>
  );
}
