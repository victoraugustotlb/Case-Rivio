import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, FileText, Loader2, Search, Sparkles, User, Users, Watch } from "lucide-react";
import type { HealthProfile } from "@/lib/profile";
import { completion, ESSENTIAL_FIELDS, filterEssentials, guidedStepFor, NONE_FIELDS, type EssentialEntry, type EssentialField, type PublicSource } from "@/lib/profile-completion";
import { suggestionConflict, suggestionText } from "@/lib/profile-suggestions";
import { profileOverviewQuery } from "@/lib/patient-settings-query";
import { acceptSuggestion, dismissSuggestion, patchHealthProfile, suggestProfileFromDocument } from "@/lib/profile.functions";
import { healthProfileQuery } from "@/lib/profile-query";

const GROUPS: { titulo: string; campos: EssentialField[] }[] = [
  { titulo: "Identificação", campos: ["nome", "idade", "sexo"] },
  { titulo: "Medidas", campos: ["altura", "peso", "imc"] },
  { titulo: "Sangue e alergias", campos: ["tipo_sanguineo", "alergias"] },
  { titulo: "Medicamentos de uso contínuo", campos: ["medicamentos"] },
  { titulo: "Condições e cirurgias", campos: ["condicoes", "cirurgias"] },
  { titulo: "Contatos de emergência", campos: ["contato_emergencia"] },
];

const dmy = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" }) : "");

/** Selo de origem: ícone e texto, nunca só cor. */
function SourceBadge({ s, docs }: { s: PublicSource; docs: Record<string, { title: string; date: string | null }> }) {
  const doc = s.documento_id ? docs[s.documento_id] : undefined;
  const map = {
    paciente: { Icon: User, text: "Você informou" },
    documento: { Icon: FileText, text: `Do documento ${doc?.title ?? ""}`.trim() + ` (confirmado em ${dmy(s.atualizado_em)})` },
    dispositivo: { Icon: Watch, text: "Do dispositivo" },
    cuidador: { Icon: Users, text: `Preenchido por ${s.por_nome ?? "outra pessoa"}` },
  } as const;
  const { Icon, text } = map[s.origem];
  return <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"><Icon className="h-3 w-3" aria-hidden />{text}</span>;
}

export function ProfileOverview({ profile }: { profile: HealthProfile | null }) {
  const qc = useQueryClient();
  const overview = useQuery(profileOverviewQuery);
  const patch = useServerFn(patchHealthProfile);
  const accept = useServerFn(acceptSuggestion);
  const dismiss = useServerFn(dismissSuggestion);
  const suggest = useServerFn(suggestProfileFromDocument);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const c = completion(profile);
  const docs = overview.data?.docTitles ?? {};
  const entries = new Map<EssentialField, EssentialEntry>(filterEssentials(profile, ESSENTIAL_FIELDS).map((e) => [e.field, e]));

  const refresh = () => { void qc.invalidateQueries({ queryKey: profileOverviewQuery.queryKey }); void qc.invalidateQueries({ queryKey: healthProfileQuery.queryKey }); };

  async function none(field: EssentialField) {
    if (!profile) return;
    setBusy(field);
    try { const r = await patch({ data: { patch: { confirmed_none: [...profile.confirmed_none, field] } } }); if (r.ok) { qc.setQueryData(healthProfileQuery.queryKey, r.profile); setNote(""); } else setNote(r.error); }
    finally { setBusy(null); }
  }
  async function answer(id: string, ok: boolean, replace = false) {
    setBusy(id);
    try { const r = ok ? await accept({ data: { id, replace } }) : await dismiss({ data: { id } }); setNote(r.ok ? "" : r.error); refresh(); }
    finally { setBusy(null); }
  }
  async function scan() {
    const ids = overview.data?.candidateDocIds ?? [];
    if (!ids.length) { setNote("Você ainda não tem documentos confirmados para procurar."); return; }
    setBusy("scan"); setNote("");
    let created = 0; let error = "";
    for (const documentId of ids) {
      try { const r = await suggest({ data: { documentId } }); if (r.ok) created += r.created ?? 0; else { error = r.error; break; } } catch { error = "Não foi possível ler agora."; break; }
    }
    setBusy(null); refresh();
    setNote(error || (created ? `Encontramos ${created} sugestão(ões). Confira abaixo.` : "Não encontramos dados novos nos seus documentos."));
  }

  return (
    <div className="space-y-6">
      <section aria-labelledby="completo" className="rounded-2xl border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="completo" className="font-display text-xl font-bold">Perfil: {c.feitos} de {c.total} itens</h2>
            <p className="text-sm text-muted-foreground">{c.percentual}% completo. Quanto mais completo, menos o médico precisa perguntar.</p>
          </div>
          <Link to="/perfil/guiado" className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">Responder uma pergunta de cada vez</Link>
        </div>
        <div role="progressbar" aria-valuenow={c.percentual} aria-valuemin={0} aria-valuemax={100} aria-label="Perfil completo" className="mt-3 h-3 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${c.percentual}%` }} /></div>
      </section>

      <section aria-labelledby="docs-sug" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="docs-sug" className="font-display text-xl font-bold">Dados encontrados nos seus documentos</h2>
          <button type="button" onClick={scan} disabled={busy === "scan" || overview.isLoading} className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 text-sm font-semibold hover:bg-accent disabled:opacity-60">
            {busy === "scan" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Search className="h-4 w-4" aria-hidden />}Buscar dados nos meus documentos
          </button>
        </div>
        {note && <p role="status" className="rounded-lg bg-accent px-3 py-2 text-sm">{note}</p>}
        {(overview.data?.suggestions ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Nada novo por enquanto. Nada entra no seu perfil sem você aceitar.</p> : (
          <ul className="space-y-3">
            {overview.data!.suggestions.map((s) => {
              const conflict = suggestionConflict(profile, s);
              const doc = s.source_document_id ? docs[s.source_document_id] : undefined;
              return (
                <li key={s.id} className="rounded-2xl border bg-card p-4">
                  <p className="flex items-start gap-2 font-medium"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-teal-strong" aria-hidden />Encontramos {doc ? `no documento “${doc.title}”${doc.date ? ` de ${dmy(doc.date)}` : ""}` : "em um documento"}: {suggestionText(s)}</p>
                  {s.excerpt && <p className="mt-1 text-sm text-muted-foreground">Trecho do original: “{s.excerpt}”</p>}
                  {conflict && <p className="mt-2 rounded-lg bg-warning-soft px-3 py-2 text-sm font-medium">Você informou {conflict}; o documento diz {suggestionText(s).replace(/^.*?:\s*/, "")}. Escolha qual vale.</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {conflict ? (
                      <>
                        <button type="button" disabled={busy === s.id} onClick={() => answer(s.id, true, true)} className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">Usar o do documento</button>
                        <button type="button" disabled={busy === s.id} onClick={() => answer(s.id, false)} className="min-h-11 rounded-lg border px-4 text-sm font-semibold hover:bg-accent">Manter o meu</button>
                      </>
                    ) : (
                      <>
                        <button type="button" disabled={busy === s.id} onClick={() => answer(s.id, true)} className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">Está certo, usar</button>
                        <button type="button" disabled={busy === s.id} onClick={() => answer(s.id, false)} className="min-h-11 rounded-lg border px-4 text-sm font-semibold hover:bg-accent">Não</button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {GROUPS.map((g) => (
          <section key={g.titulo} aria-label={g.titulo} className="rounded-2xl border bg-card p-5">
            <h2 className="font-display text-lg font-bold">{g.titulo}</h2>
            <dl className="mt-3 space-y-4">
              {g.campos.map((f) => {
                const e = entries.get(f)!;
                const step = guidedStepFor(f);
                const canNone = (NONE_FIELDS as readonly string[]).includes(f);
                return (
                  <div key={f}>
                    <dt className="text-sm font-semibold">{e.label}</dt>
                    <dd className="mt-0.5">
                      {e.state === "preenchido" && <><p className="break-words">{e.value}</p>{e.source && <div className="mt-1"><SourceBadge s={e.source} docs={docs} /></div>}</>}
                      {e.state === "nenhum_confirmado" && <p>Nenhuma conhecida{e.confirmedAt ? ` (confirmado em ${dmy(e.confirmedAt)})` : " (confirmado por você)"}</p>}
                      {e.state === "nao_informado" && (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-muted-foreground">Não informado</span>
                          {f !== "imc" && (step
                            ? <Link to="/perfil/guiado" search={{ campo: step }} className="inline-flex min-h-11 items-center rounded-lg border px-3 text-sm font-semibold hover:bg-accent">Preencher</Link>
                            : <a href="#editar" className="inline-flex min-h-11 items-center rounded-lg border px-3 text-sm font-semibold hover:bg-accent">Preencher</a>)}
                          {canNone && <button type="button" disabled={busy === f} onClick={() => none(f)} className="min-h-11 rounded-lg border px-3 text-sm font-semibold hover:bg-accent disabled:opacity-60">Não tenho</button>}
                        </div>
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </section>
        ))}

        <section aria-label="Plano de saúde" className="rounded-2xl border bg-card p-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold"><CreditCard className="h-5 w-5 text-brand-teal-strong" aria-hidden />Plano de saúde</h2>
          {overview.data?.plan ? <p className="mt-3">{overview.data.plan.name} · carteirinha final {overview.data.plan.last4} · {overview.data.plan.role === "titular" ? "titular" : "dependente"}</p> : <p className="mt-3 text-muted-foreground">Sem plano ligado a esta conta.</p>}
        </section>

        <section aria-label="Dispositivos" className="rounded-2xl border bg-card p-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold"><Watch className="h-5 w-5 text-brand-teal-strong" aria-hidden />Dispositivos e medições</h2>
          <p className="mt-3 text-sm text-muted-foreground">Anote medições ou conecte seu relógio.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link to="/dispositivos" className="inline-flex min-h-11 items-center rounded-lg border px-3 text-sm font-semibold hover:bg-accent">Abrir meus aparelhos</Link>
            <Link to="/dispositivos/painel" className="inline-flex min-h-11 items-center rounded-lg border px-3 text-sm font-semibold hover:bg-accent">Ver últimas medições</Link>
          </div>
        </section>

        <section aria-label="Últimos exames" className="rounded-2xl border bg-card p-5 md:col-span-2">
          <h2 className="font-display text-lg font-bold">Últimos exames e documentos</h2>
          {(overview.data?.latestDocs ?? []).length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Nenhum documento confirmado ainda.</p> : (
            <ul className="mt-3 divide-y">
              {overview.data!.latestDocs.map((d) => <li key={d.id}><Link to="/documentos/$id" params={{ id: d.id }} className="flex min-h-11 items-center justify-between gap-3 py-2 hover:underline"><span className="truncate">{d.title}</span><span className="shrink-0 text-sm text-muted-foreground">{d.doc_date ? new Date(d.doc_date).toLocaleDateString("pt-BR") : d.kind}</span></Link></li>)}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
