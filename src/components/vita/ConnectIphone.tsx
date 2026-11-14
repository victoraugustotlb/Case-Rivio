import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useHydrated } from "@tanstack/react-router";
import { Check, Copy, ExternalLink, KeyRound, Loader2 } from "lucide-react";
import { createIngestToken } from "@/lib/wearables.functions";

const APP_URL = "https://apps.apple.com/app/id1115567069";

function CopyField({ label, value }: { label: string; value: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 break-all text-sm">{value}</code>
        <button type="button" onClick={async () => { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 2500); }}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm font-semibold hover:bg-accent">{done ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}{done ? "Copiado" : "Copiar"}</button>
      </div>
    </div>
  );
}

/** Apple Watch pelo iPhone: o app Health Auto Export (de terceiros) lê o app Saúde e envia ao Anamedis. */
export function ConnectIphone() {
  const hydrated = useHydrated();
  const make = useServerFn(createIngestToken);
  const qc = useQueryClient();
  const [pass, setPass] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const address = `${hydrated ? window.location.origin : ""}/api/public/wearables/ingest`;

  async function generate() {
    setBusy(true); setErr("");
    try { const r = await make({ data: { label: "iPhone (Apple Saúde)" } }); setPass(r.token); void qc.invalidateQueries({ queryKey: ["ingest-tokens"] }); }
    catch { setErr("Não foi possível gerar agora. Tente de novo."); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4 rounded-2xl border bg-card p-5">
      <p className="text-sm">O Apple Watch envia os dados para o app <strong>Saúde</strong> do iPhone. Para o Anamedis receber, você usa um app gratuito para baixar, o <strong>Health Auto Export</strong>. Ele lê o app Saúde e manda para cá. O envio automático em segundo plano pode exigir uma assinatura ou o período de teste do próprio app.</p>
      <ol className="space-y-4 text-sm">
        <li><p className="font-semibold">1. Instale o app no iPhone</p>
          <a href={APP_URL} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 font-semibold text-brand-teal-strong hover:bg-accent">Abrir na App Store<ExternalLink className="h-4 w-4" aria-hidden /></a></li>
        <li><p className="font-semibold">2. Gere sua senha de conexão</p>
          {!pass ? (
            <button type="button" onClick={generate} disabled={busy} className="mt-1 inline-flex min-h-12 items-center gap-2 rounded-lg bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <KeyRound className="h-4 w-4" aria-hidden />}Gerar minha senha</button>
          ) : (
            <div className="mt-2 space-y-2">
              <p role="status" className="rounded-lg bg-warning-soft p-2 text-xs font-semibold">Copie agora. Por segurança, esta senha não aparece de novo. Se perder, gere outra.</p>
              <CopyField label="Endereço de envio" value={address} />
              <CopyField label="Senha completa (cole exatamente assim)" value={`Bearer ${pass}`} />
            </div>
          )}
          {err && <p role="alert" className="mt-1 text-destructive">{err}</p>}
        </li>
        <li><p className="font-semibold">3. No app Health Auto Export</p>
          <ul className="ml-4 mt-1 list-disc space-y-1 text-muted-foreground">
            <li>Crie uma automação (<em>Automations</em>) do tipo <strong>REST API</strong> (é assim que o nome aparece no app).</li>
            <li>Em <em>URL</em>, cole o <strong>Endereço de envio</strong>.</li>
            <li>Em <em>Headers</em>, adicione um cabeçalho com o nome <strong>Authorization</strong> e, no valor, cole a <strong>Senha completa</strong>.</li>
            <li>Formato: <strong>JSON</strong>. Em dados, escolha frequência cardíaca, pressão, glicose, sono e passos.</li>
            <li>Em agrupamento dos passos e do sono, escolha <strong>dia</strong>.</li>
          </ul></li>
        <li><p className="font-semibold">4. Toque em sincronizar</p><p className="text-muted-foreground">Use a sincronização manual do app. Em poucos instantes o aparelho aparece em “Seus aparelhos” com a hora da última leitura.</p></li>
      </ol>
      <p className="text-xs text-muted-foreground">Os dados chegam quando o iPhone sincroniza (em geral até cerca de 1 hora), não na hora exata. Você pode desconectar e apagar tudo a qualquer momento.</p>
    </div>
  );
}
