import { UFS } from "@/lib/clinic";

export type DoctorForm = { full_name: string; crm: string; uf: string; specialty: string };

export function DoctorFields({ f, setF }: { f: { full_name: string; crm: string; uf: string; specialty: string }; setF: (v: { full_name: string; crm: string; uf: string; specialty: string }) => void }) {
  const input = "mt-1 min-h-11 w-full rounded-lg border bg-card px-3";
  return (
    <div className="mt-4 space-y-4">
      <label className="block"><span className="text-sm font-medium">Nome completo</span><input required minLength={2} value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} className={input} /></label>
      <div className="grid grid-cols-[1fr_6rem] gap-3">
        <label className="block"><span className="text-sm font-medium">CRM</span><input required inputMode="numeric" pattern="[0-9]{3,8}" value={f.crm} onChange={(e) => setF({ ...f, crm: e.target.value.replace(/\D/g, "").slice(0, 8) })} className={input} /></label>
        <label className="block"><span className="text-sm font-medium">UF</span><select value={f.uf} onChange={(e) => setF({ ...f, uf: e.target.value })} className={input}>{UFS.map((u) => <option key={u}>{u}</option>)}</select></label>
      </div>
      <label className="block"><span className="text-sm font-medium">Especialidade</span><input value={f.specialty} maxLength={80} onChange={(e) => setF({ ...f, specialty: e.target.value })} className={input} /></label>
    </div>
  );
}
