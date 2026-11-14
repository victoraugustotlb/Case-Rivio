import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2, Settings2 } from "lucide-react";
import { AppShell, PageTitle } from "@/components/vita/AppShell";
import { Button } from "@/components/ui/button";
import { WearablePanel, DISCLAIMER } from "@/components/vita/WearablePanel";
import { WearableEmpty } from "@/components/vita/WearableEmpty";
import { readingsQuery, useReadingsRealtime } from "@/lib/wearables-query";
import { WINDOWS } from "@/lib/wearables";

export const Route = createFileRoute("/_authenticated/dispositivos/painel")({
  head: () => ({
    meta: [
      { title: "Painel de dispositivos — Anamedis" },
      { name: "description", content: "Frequência cardíaca, sono, passos e outros sinais enviados pelos seus dispositivos." },
      { property: "og:title", content: "Painel de dispositivos — Anamedis" },
      { property: "og:description", content: "Seus sinais de dispositivo, atualizados quando chegam." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Painel,
});

function Painel() {
  useReadingsRealtime();
  const q = useQuery(readingsQuery(WINDOWS["30d"]));
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const i = setInterval(() => setNow(new Date()), 15_000); return () => clearInterval(i); }, []);
  const rows = q.data ?? [];
  return (
    <AppShell>
      <div className="mx-auto max-w-6xl">
        <PageTitle title="Painel de dispositivos" subtitle="Atualiza sozinho quando uma leitura nova chega." action={<Button asChild variant="outline" className="min-h-11"><Link to="/dispositivos"><Settings2 aria-hidden />Conexões</Link></Button>} />
        {q.isLoading ? <Loader2 className="h-6 w-6 animate-spin" aria-label="Carregando" /> : q.isError ? <p role="alert">Não foi possível carregar as leituras.</p> : rows.length === 0 ? <div className="space-y-3"><WearableEmpty /><p className="text-xs text-muted-foreground">{DISCLAIMER}</p></div> : <WearablePanel rows={rows} now={now} />}
      </div>
    </AppShell>
  );
}
