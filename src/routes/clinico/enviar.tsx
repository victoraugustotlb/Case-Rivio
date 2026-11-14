import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { extractDocument } from "@/lib/documents.functions";
import { listMyUploads, listUploadTargets, submitProDocument } from "@/lib/pro.functions";
import { PRO_DOC_TYPES, type ProDocType } from "@/lib/clinic";
import { ProPage, StatusTag, fmtDT, td, th } from "@/components/vita/pro-ui";

export const Route = createFileRoute("/clinico/enviar")({
  head: () => ({ meta: [
    { title: "Adicionar documento ao paciente — VITA Clínico" }, { name: "description", content: "Envie laudos, exames e receitas a pacientes que liberaram o envio." },
    { property: "og:title", content: "Adicionar documento — VITA Clínico" }, { property: "og:description", content: "O paciente aceita antes do documento entrar no histórico." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: Enviar,
});

type Field = { label: string; value: string; ai_value?: string; excerpt?: string; confidence?: "alta" | "media" | "baixa" };
const input = "h-9 w-full rounded border bg-background px-2 text-sm";

function Enviar() {
  const qc = useQueryClient();
  const targetsFn = useServerFn(listUploadTargets), upsFn = useServerFn(listMyUploads);
  const extract = useServerFn(extractDocument), submit = useServerFn(submitProDocument);
  const t = useQuery({ queryKey: ["pro-upload-targets"], queryFn: () => targetsFn() });
  const ups = useQuery({ queryKey: ["pro-uploads"], queryFn: () => upsFn() });
  const [patientId, setPatientId] = useState("");
  const [file, setFile] = useState<{ path: string; type: string; name: string } | null>(null);
  const [type, setType] = useState<ProDocType>("laudo");
  const [title, setTitle] = useState(""), [date, setDate] = useState(""), [note, setNote] = useState(""), [summary, setSummary] = useState("");
  const [fields, setFields] = useState<Field[]>([]);
  const [busy, setBusy] = useState<"" | "up" | "ai" | "send">("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    const { data: u } = await supabase.auth.getUser(); if (!u.user) return;
    if (f.size > 20 * 1024 * 1024) { setMsg({ ok: false, text: "Arquivo acima de 20 MB." }); return; }
    setBusy("up"); setMsg(null);
    if (file) await supabase.storage.from("medical-documents").remove([file.path]);
    const ext = (f.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${u.user.id}/pro-${crypto.randomUUID()}.${ext}`;
    const up = await supabase.storage.from("medical-documents").upload(path, f, { contentType: f.type });
    setBusy("");
    if (up.error) { setMsg({ ok: false, text: "Não foi possível carregar o arquivo." }); return; }
    setFile({ path, type: f.type || "application/octet-stream", name: f.name });
  };
  const ler = async () => {
    if (!file) return; setBusy("ai"); setMsg(null);
    try {
      const r = await extract({ data: { path: file.path } });
      if (!r.legivel) setMsg({ ok: false, text: "A leitura não reconheceu um documento médico legível. Preencha manualmente." });
      else { setTitle((v) => v || r.titulo); setDate((v) => v || r.data); setSummary(r.resumo); setFields(r.campos.map((c) => ({ label: c.rotulo, value: c.valor, ai_value: c.valor, excerpt: c.trecho, confidence: c.confianca }))); }
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Leitura indisponível." }); } finally { setBusy(""); }
  };
  const enviar = async () => {
    if (!file || !patientId || !title.trim()) return;
    setBusy("send"); setMsg(null);
    try {
      await submit({ data: { patientId, path: file.path, fileType: file.type, type, title, docDate: date, note, summary, fields } });
      setFile(null); setTitle(""); setDate(""); setNote(""); setSummary(""); setFields([]);
      setMsg({ ok: true, text: "Enviado. O documento fica aguardando a aceitação do paciente." });
      void qc.invalidateQueries({ queryKey: ["pro-uploads"] });
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Não foi possível enviar." }); } finally { setBusy(""); }
  };

  const targets = t.data?.targets ?? [];
  return (
    <ProPage title="Adicionar documento" subtitle="Só para pacientes que liberaram o envio, enquanto o acesso estiver ativo. O arquivo vai sem alteração.">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="space-y-3 rounded border bg-card p-3">
          {t.isLoading ? <Loader2 className="h-5 w-5 animate-spin text-primary" aria-label="Carregando" /> : targets.length === 0 ? (
            <p className="rounded bg-muted p-3 text-xs">Nenhum paciente liberou o envio de documentos no momento. Peça a permissão em <strong>Pedir acesso</strong>.</p>
          ) : (<>
            <label className="block text-xs font-semibold">Paciente
              <select value={patientId} onChange={(e) => setPatientId(e.target.value)} className={`mt-1 ${input}`}>
                <option value="">Selecione…</option>
                {targets.map((p) => <option key={p.patientId} value={p.patientId}>{p.name} · {p.ref}</option>)}
              </select></label>
            <label className="block text-xs font-semibold">Arquivo ou foto (PDF, JPG, PNG)
              <input type="file" accept="application/pdf,image/*" capture="environment" onChange={(e) => void pick(e.target.files?.[0])} className="mt-1 block w-full text-xs" /></label>
            {busy === "up" && <p className="flex items-center gap-1 text-xs"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />Carregando…</p>}
            {file && <p className="flex items-center gap-2 text-xs">{file.name}<button onClick={ler} disabled={!!busy} className="inline-flex h-8 items-center gap-1 rounded border px-2 font-semibold"><Sparkles className="h-3.5 w-3.5" aria-hidden />{busy === "ai" ? "Lendo…" : "Ler com IA (opcional)"}</button></p>}
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-xs font-semibold">Tipo<select value={type} onChange={(e) => setType(e.target.value as ProDocType)} className={`mt-1 ${input}`}>{PRO_DOC_TYPES.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}</select></label>
              <label className="text-xs font-semibold">Data<input value={date} onChange={(e) => setDate(e.target.value)} placeholder="DD/MM/AAAA" className={`mt-1 ${input}`} /></label>
            </div>
            <label className="block text-xs font-semibold">Título<input value={title} onChange={(e) => setTitle(e.target.value)} className={`mt-1 ${input}`} /></label>
            <label className="block text-xs font-semibold">Emissor<input value={t.data ? `${t.data.me.name} · ${t.data.me.credential}` : ""} readOnly className={`mt-1 ${input} bg-muted`} /></label>
            <label className="block text-xs font-semibold">Observação<textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="mt-1 w-full rounded border bg-background p-2 text-sm" /></label>
            {fields.length > 0 && (
              <div className="rounded border">
                <p className="border-b bg-muted/50 px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Confira a leitura antes de enviar</p>
                {fields.map((f, i) => (
                  <div key={i} className="flex gap-1 border-b p-1">
                    <input aria-label="Campo" value={f.label} onChange={(e) => setFields(fields.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} className="h-8 w-1/3 rounded border px-1 text-xs" />
                    <input aria-label="Valor" value={f.value} onChange={(e) => setFields(fields.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} className="h-8 flex-1 rounded border px-1 text-xs" />
                    <button aria-label="Remover campo" onClick={() => setFields(fields.filter((_, j) => j !== i))} className="grid h-8 w-8 place-items-center rounded hover:bg-muted"><Trash2 className="h-3.5 w-3.5" aria-hidden /></button>
                  </div>
                ))}
              </div>
            )}
            {msg && <p role="status" className={`rounded p-2 text-xs ${msg.ok ? "bg-success-soft text-success" : "bg-danger-soft"}`}>{msg.text}</p>}
            <button onClick={enviar} disabled={!file || !patientId || !title.trim() || !!busy} className="flex h-9 items-center gap-2 rounded bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-50">{busy === "send" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Enviar ao paciente</button>
          </>)}
        </section>
        <section className="overflow-x-auto rounded border bg-card">
          <h2 className="border-b px-2 py-1.5 text-xs font-semibold">Documentos que você enviou</h2>
          <table className="w-full text-[12px]"><thead><tr><th className={th}>Documento</th><th className={th}>Paciente</th><th className={th}>Estado</th></tr></thead>
            <tbody>{(ups.data ?? []).map((d) => (
              <tr key={d.id}><td className={td}>{d.title}<br /><span className="text-[11px] text-muted-foreground">{fmtDT(d.createdAt)}</span></td><td className={td}>{d.patient}</td><td className={td}><StatusTag s={d.status} /></td></tr>
            ))}{(ups.data ?? []).length === 0 && <tr><td colSpan={3} className={`${td} text-muted-foreground`}>Nenhum envio ainda.</td></tr>}</tbody></table>
        </section>
      </div>
    </ProPage>
  );
}
