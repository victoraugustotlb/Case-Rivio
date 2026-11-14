import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { readingsQuery, useReadingsRealtime } from "@/lib/wearables-query";
import { WINDOWS } from "@/lib/wearables";
import { MetricCards, DISCLAIMER } from "@/components/vita/WearablePanel";
import { WearableEmpty } from "@/components/vita/WearableEmpty";

/** Resumo de dispositivos no Início: só leituras reais; sem leitura, estado vazio. */
export function WearableHomeCard() {
  useReadingsRealtime();
  const q = useQuery(readingsQuery(WINDOWS["7d"]));
  const rows = q.data ?? [];
  return (
    <section aria-labelledby="disp">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 id="disp" className="font-display text-xl font-bold">Dispositivos</h2>
        <Link to={rows.length ? "/dispositivos/painel" : "/dispositivos"} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand-teal-strong">{rows.length ? "Ver painel" : "Conectar"}<ChevronRight className="h-4 w-4" aria-hidden /></Link>
      </div>
      {q.isLoading ? null : rows.length === 0 ? <WearableEmpty compact /> : <><MetricCards rows={rows} now={new Date()} windowMs={WINDOWS["24h"]} limit={3} /><p className="mt-2 text-xs text-muted-foreground">{DISCLAIMER}</p></>}
    </section>
  );
}
