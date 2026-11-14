// Sugestões do perfil a partir de documentos — funções puras, testadas em profile-suggestions.test.ts.
// Nada entra no perfil sem o paciente aceitar: estas funções só limpam e aplicam uma escolha explícita.
import type { HealthProfile } from "./profile";

export type SuggestionField = "blood_type" | "allergies" | "medications" | "conditions" | "height_cm" | "weight_kg";
export const SUGGESTION_LABELS: Record<SuggestionField, string> = { blood_type: "tipo sanguíneo", allergies: "alergia", medications: "medicamento", conditions: "condição", height_cm: "altura", weight_kg: "peso" };
type Row = { field: SuggestionField; value: unknown; excerpt: string; confidence: number };
const BLOOD = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const clamp = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Descarta tudo que não tem citação literal ou está fora de faixa — nunca inventar. */
export function cleanSuggestions(raw: unknown): Row[] {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, any>;
  const out: Row[] = [];
  const push = (field: SuggestionField, value: unknown, it: any) => {
    const excerpt = str(it?.trecho, 500);
    if (!excerpt) return;
    out.push({ field, value, excerpt, confidence: clamp(it?.confianca) });
  };
  if (r["tipo_sanguineo"] && BLOOD.includes(r["tipo_sanguineo"].valor)) push("blood_type", r["tipo_sanguineo"].valor, r["tipo_sanguineo"]);
  for (const a of Array.isArray(r["alergias"]) ? r["alergias"] : []) if (str(a?.valor)) push("allergies", str(a.valor), a);
  for (const c of Array.isArray(r["condicoes"]) ? r["condicoes"] : []) if (str(c?.valor)) push("conditions", str(c.valor), c);
  for (const m of Array.isArray(r["medicamentos"]) ? r["medicamentos"] : []) if (str(m?.nome)) push("medications", { name: str(m.nome, 150), dose: str(m.dose, 100), frequency: str(m.frequencia, 150) }, m);
  const h = r["altura_cm"]?.valor; if (typeof h === "number" && h >= 30 && h <= 250) push("height_cm", Math.round(h), r["altura_cm"]);
  const w = r["peso_kg"]?.valor; if (typeof w === "number" && w >= 2 && w <= 700) push("weight_kg", Math.round(w * 10) / 10, r["peso_kg"]);
  return out.slice(0, 40);
}

const lines = (t: string) => t.split(/[\n;,]/).map((x) => x.trim().toLowerCase()).filter(Boolean);
const addLine = (text: string, v: string) => (lines(text).includes(v.toLowerCase()) ? text : text.trim() ? `${text.trim()}\n${v}` : v);

/** Há conflito com algo já informado (valores únicos diferentes)? */
export function suggestionConflict(p: HealthProfile | null, s: { field: SuggestionField; value: unknown }): string | null {
  if (!p) return null;
  if (s.field === "blood_type") return p.blood_type && p.blood_type !== s.value ? p.blood_type : null;
  if (s.field === "height_cm") return p.height_cm !== null && p.height_cm !== s.value ? `${p.height_cm} cm` : null;
  if (s.field === "weight_kg") return p.weight_kg !== null && p.weight_kg !== s.value ? `${p.weight_kg} kg` : null;
  return null;
}

export function suggestionText(s: { field: SuggestionField; value: unknown }): string {
  if (s.field === "medications") { const m = s.value as { name: string; dose: string; frequency: string }; return [m.name, m.dose, m.frequency].filter(Boolean).join(" "); }
  if (s.field === "height_cm") return `${s.value} cm`;
  if (s.field === "weight_kg") return `${s.value} kg`;
  return String(s.value);
}

/** Aplica UMA sugestão aceita. Valor único diferente do informado só troca com replace = true. */
export function applySuggestion(p: HealthProfile, s: { field: SuggestionField; value: unknown }, replace: boolean): { ok: true; profile: HealthProfile } | { ok: false; error: string } {
  if (suggestionConflict(p, s) && !replace) return { ok: false, error: "Você já informou outro valor. Escolha qual manter." };
  switch (s.field) {
    case "blood_type": return { ok: true, profile: { ...p, blood_type: s.value as HealthProfile["blood_type"] } };
    case "height_cm": return { ok: true, profile: { ...p, height_cm: Number(s.value) } };
    case "weight_kg": return { ok: true, profile: { ...p, weight_kg: Number(s.value) } };
    case "allergies": return { ok: true, profile: { ...p, allergies: addLine(p.allergies, String(s.value)) } };
    case "conditions": return { ok: true, profile: { ...p, conditions: addLine(p.conditions, String(s.value)) } };
    case "medications": {
      const m = s.value as HealthProfile["medications"][number];
      if (p.medications.some((x) => x.name.toLowerCase() === m.name.toLowerCase())) return { ok: true, profile: p };
      return { ok: true, profile: { ...p, medications: [...p.medications, m].slice(0, 50) } };
    }
  }
}
