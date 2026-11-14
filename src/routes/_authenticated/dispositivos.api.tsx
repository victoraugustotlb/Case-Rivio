import { createFileRoute, Link, useHydrated } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Check, Copy, KeyRound, Loader2 } from "lucide-react";
import { AppShell, PageTitle } from "@/components/vita/AppShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { createIngestToken, revokeIngestToken } from "@/lib/wearables.functions";
import { INGEST_MAX_READINGS, INGEST_RATE_PER_MIN, METRICS, METRIC_IDS, agoText } from "@/lib/wearables";

export const Route = createFileRoute("/_authenticated/dispositivos/api")({
  head: () => ({
    meta: [
      { title: "API de dispositivos — Anamedis" },
      { name: "description", content: "Gere tokens para outros aplicativos enviarem leituras ao seu histórico." },
      { property: "og:title", content: "API de dispositivos — Anamedis" },
      { property: "og:description", content: "Tokens pessoais para envio de leituras." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ApiTokens,
});

const tokensQuery = { queryKey: ["ingest-tokens"], queryFn: async () => {
  const { data, error } = await supabase.from("wearable_ingest_tokens").select("id,label,last_used_at,revoked_at,created_at").order("created_at", { ascending: false });
  if (error) throw error; return data ?? [];
} };

function ApiTokens() {
  const qc = useQueryClient();
  const q = useQuery(tokensQuery);
  const createFn = useServerFn(createIngestToken);
  const revokeFn = useServerFn(revokeIngestToken);
  const [label, setLabel] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const hydrated = useHydrated();
  const endpoint = `${hydrated ? window.location.origin : "https://design-still-studio.lovable.app"}/api/public/wearables/ingest`;

  async function create(e: React.FormEvent) {
    e.preventDefault(); if (!label.trim()) return;
    setBusy(true);
    try { const r = await createFn({ data: { label: label.trim() } }); setToken(r.token); setLabel(""); setCopied(false); void qc.invalidateQueries({ queryKey: ["ingest-tokens"] }); } finally { setBusy(false); }
  }
  async function revoke(id: string) {
    if (!window.confirm("Revogar este token? O aplicativo que o usa deixa de conseguir enviar leituras.")) return;
    await revokeFn({ data: { id } }); void qc.invalidateQueries({ queryKey: ["ingest-tokens"] });
  }
  const now = new Date();
  const example = `curl -X POST ${endpoint} \\
  -H "Authorization: Bearer SEU_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"device":{"name":"Meu app","model":"v1"},"readings":[{"metric":"heart_rate","value":72,"unit":"bpm","measured_at":"2026-11-14T12:00:00Z"}]}'`;

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-8">
        <Link to="/dispositivos" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-brand-teal-strong"><ArrowLeft className="h-4 w-4" aria-hidden />Dispositivos</Link>
        <PageTitle title="Outros aplicativos (API)" subtitle="Cada aplicativo recebe um token próprio. Você pode revogá-lo quando quiser." />
        <form onSubmit={create} className="flex flex-wrap items-end gap-2 rounded-2xl border bg-card p-5">
          <label className="min-w-0 flex-1 text-sm font-medium">Nome do aplicativo<input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} placeholder="Ex.: Atalhos do iPhone" className="mt-1 min-h-11 w-full rounded-lg border bg-card px-3" /></label>
          <Button type="submit" className="min-h-11" disabled={busy || !label.trim()}>{busy ? <Loader2 className="animate-spin" aria-hidden /> : <KeyRound aria-hidden />}Gerar token</Button>
        </form>
        {token && (
          <div role="status" className="rounded-2xl border-2 border-brand-teal bg-accent p-5">
            <p className="text-sm font-semibold">Copie agora: este token não será mostrado de novo.</p>
            <div className="mt-2 flex flex-wrap items-center gap-2"><code className="min-w-0 flex-1 break-all rounded bg-card px-3 py-2 font-mono text-sm">{token}</code>
              <Button variant="outline" className="min-h-11" onClick={async () => { await navigator.clipboard.writeText(token); setCopied(true); }}>{copied ? <Check aria-hidden /> : <Copy aria-hidden />}{copied ? "Copiado" : "Copiar"}</Button></div>
          </div>
        )}
        <section>
          <h2 className="mb-3 font-display text-xl font-bold">Tokens</h2>
          {q.isLoading ? <Loader2 className="h-5 w-5 animate-spin" aria-label="Carregando" /> : (q.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Nenhum token ainda.</p> : (
            <ul className="divide-y rounded-2xl border bg-card">{(q.data ?? []).map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1"><p className="font-medium">{t.label}</p><p className="text-sm text-muted-foreground">{t.revoked_at ? "Revogado" : t.last_used_at ? `Último uso ${agoText(t.last_used_at, now)}` : "Ainda não usado"}</p></div>
                {!t.revoked_at && <Button variant="outline" className="min-h-11 text-destructive" onClick={() => revoke(t.id)}>Revogar</Button>}
              </li>))}</ul>
          )}
        </section>
        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold">Como enviar</h2>
          <p className="text-sm">POST com o token no cabeçalho <code className="font-mono">Authorization: Bearer</code>. Até {INGEST_MAX_READINGS} leituras por chamada e {INGEST_RATE_PER_MIN} chamadas por minuto. Leituras repetidas (mesma métrica, horário e aparelho) são ignoradas.</p>
          <pre className="overflow-x-auto rounded-xl bg-primary p-4 text-xs text-primary-foreground"><code>{example}</code></pre>
          <p className="text-sm">Resposta: <code className="font-mono">{'{ "accepted": 1, "duplicates": 0, "rejected": [{ "index": 0, "reason": "fora_da_faixa" }] }'}</code>. Token revogado ou inválido: 401. Limite excedido: 429.</p>
          <table className="w-full rounded-xl border bg-card text-sm">
            <thead><tr className="text-left text-muted-foreground"><th className="p-2 font-medium">metric</th><th className="p-2 font-medium">unit</th><th className="p-2 font-medium">Faixa aceita</th></tr></thead>
            <tbody>{METRIC_IDS.map((m) => <tr key={m} className="border-t"><td className="p-2 font-mono">{m}</td><td className="p-2 font-mono">{METRICS[m].unit}</td><td className="p-2">{METRICS[m].min}–{METRICS[m].max} · {METRICS[m].label}</td></tr>)}</tbody>
          </table>
        </section>
      </div>
    </AppShell>
  );
}
