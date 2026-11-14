import { UFS } from "@/lib/clinic";

export type LabForm = { legal_name: string; cnpj: string; tech_lead_name: string; tech_lead_registry: string; city: string; uf: string };
export const emptyLab: LabForm = { legal_name: "", cnpj: "", tech_lead_name: "", tech_lead_registry: "", city: "", uf: "SP" };

export function LabFields({ f, setF }: { f: LabForm; setF: (v: LabForm) => void }) {
  const input = "mt-1 min-h-11 w-full rounded-lg border bg-card px-3";
  const set = (k: keyof LabForm, v: string) => setF({ ...f, [k]: v });
  return (
    <div className="mt-4 space-y-4">
      <label className="block"><span className="text-sm font-medium">Razão social</span><input required minLength={2} maxLength={200} value={f.legal_name} onChange={(e) => set("legal_name", e.target.value)} className={input} /></label>
      <label className="block"><span className="text-sm font-medium">CNPJ</span><input required inputMode="numeric" pattern="[0-9]{14}" title="14 dígitos" value={f.cnpj} onChange={(e) => set("cnpj", e.target.value.replace(/\D/g, "").slice(0, 14))} className={input} /></label>
      <div className="grid grid-cols-[1fr_9rem] gap-3">
        <label className="block"><span className="text-sm font-medium">Responsável técnico</span><input required minLength={2} value={f.tech_lead_name} onChange={(e) => set("tech_lead_name", e.target.value)} className={input} /></label>
        <label className="block"><span className="text-sm font-medium">Registro (ex.: CRM, CRF, CRBM)</span><input required minLength={2} maxLength={40} value={f.tech_lead_registry} onChange={(e) => set("tech_lead_registry", e.target.value)} className={input} /></label>
      </div>
      <div className="grid grid-cols-[1fr_6rem] gap-3">
        <label className="block"><span className="text-sm font-medium">Cidade</span><input required minLength={2} value={f.city} onChange={(e) => set("city", e.target.value)} className={input} /></label>
        <label className="block"><span className="text-sm font-medium">UF</span><select value={f.uf} onChange={(e) => set("uf", e.target.value)} className={input}>{UFS.map((u) => <option key={u}>{u}</option>)}</select></label>
      </div>
    </div>
  );
}
