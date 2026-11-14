import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DoctorFields } from "@/components/vita/DoctorFields";
import { LabFields, emptyLab, type LabForm } from "@/components/vita/LabFields";

export function NoDoctor({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({ full_name: "", crm: "", uf: "SP", specialty: "" });
  const [error, setError] = useState("");
  return (
    <main className="grid min-h-screen place-items-center bg-background p-4">
      <form className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-soft" onSubmit={async (e) => {
        e.preventDefault(); setError("");
        const { error } = await supabase.from("doctor_profiles").insert({ ...f, crm: f.crm.replace(/\D/g, "") });
        if (error) setError("Confira o nome e o CRM (apenas números)."); else onDone();
      }}>
        <h1 className="font-display text-2xl font-bold">Complete seu cadastro profissional</h1>
        <p className="mt-1 text-sm text-muted-foreground">Esses dados aparecem para o paciente quando você pedir acesso.</p>
        <DoctorFields f={f} setF={setF} />
        {error && <p role="alert" className="mt-4 rounded-lg bg-danger-soft p-3 text-sm">{error}</p>}
        <button className="mt-5 min-h-12 w-full rounded-lg bg-primary font-semibold text-primary-foreground">Salvar</button>
        <Link to="/inicio" className="mt-3 block text-center text-sm text-muted-foreground underline">Sou paciente</Link>
      </form>
    </main>
  );
}


export function NoLab({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState<LabForm>(emptyLab);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 font-sans">
      <form className="w-full max-w-md" onSubmit={async (e) => {
        e.preventDefault(); setBusy(true); setErr("");
        const { error } = await supabase.from("lab_profiles").insert(f);
        setBusy(false);
        if (error) setErr("Confira os dados: CNPJ com 14 dígitos e todos os campos preenchidos."); else onDone();
      }}>
        <h1 className="font-display text-2xl font-bold">Cadastro do laboratório ou clínica</h1>
        <LabFields f={f} setF={setF} />
        {err && <p role="alert" className="mt-3 rounded-lg bg-danger-soft p-3 text-sm">{err}</p>}
        <button disabled={busy} className="mt-5 min-h-12 w-full rounded-lg bg-primary font-semibold text-primary-foreground disabled:opacity-60">Salvar</button>
      </form>
    </main>
  );
}
