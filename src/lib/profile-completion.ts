// Ficha essencial e completude do perfil — funções puras, testadas em profile-completion.test.ts.
import { ageFromBirthDate, type HealthProfile } from "./profile";

export const ESSENTIAL_FIELDS = ["nome", "idade", "sexo", "altura", "peso", "imc", "tipo_sanguineo", "alergias", "medicamentos", "condicoes", "cirurgias", "contato_emergencia"] as const;
export type EssentialField = (typeof ESSENTIAL_FIELDS)[number];
export const ESSENTIAL_LABELS: Record<EssentialField, string> = {
  nome: "Nome", idade: "Idade", sexo: "Sexo", altura: "Altura", peso: "Peso", imc: "IMC", tipo_sanguineo: "Tipo sanguíneo",
  alergias: "Alergias", medicamentos: "Medicamentos", condicoes: "Condições", cirurgias: "Cirurgias", contato_emergencia: "Contato de emergência",
};
/** Campos que o paciente pode confirmar que não tem. */
export const NONE_FIELDS = ["alergias", "medicamentos", "condicoes", "cirurgias"] as const;
export type NoneField = (typeof NONE_FIELDS)[number];
export type FieldState = "preenchido" | "nenhum_confirmado" | "nao_informado";
export type FieldSource = HealthProfile["field_sources"][string];

/** Coluna do perfil que guarda cada campo da ficha (idade e IMC são calculados). */
export const FIELD_COLUMNS: Record<EssentialField, (keyof HealthProfile)[]> = {
  nome: ["full_name"], idade: ["birth_date"], sexo: ["sex"], altura: ["height_cm"], peso: ["weight_kg"], imc: ["height_cm", "weight_kg"],
  tipo_sanguineo: ["blood_type"], alergias: ["allergies"], medicamentos: ["medications"], condicoes: ["conditions"], cirurgias: ["surgeries"], contato_emergencia: ["emergency_contacts"],
};

function filled(p: HealthProfile, f: EssentialField): boolean {
  switch (f) {
    case "nome": return p.full_name.trim().length > 0;
    case "idade": return ageFromBirthDate(p.birth_date) !== null;
    case "sexo": return p.sex !== "";
    case "altura": return p.height_cm !== null;
    case "peso": return p.weight_kg !== null;
    case "imc": return bmi(p.height_cm, p.weight_kg) !== null;
    case "tipo_sanguineo": return p.blood_type !== "";
    case "alergias": return p.allergies.trim().length > 0;
    case "medicamentos": return p.medications.length > 0;
    case "condicoes": return p.conditions.trim().length > 0;
    case "cirurgias": return p.surgeries.trim().length > 0;
    case "contato_emergencia": return p.emergency_contacts.length > 0;
  }
}

/** Vazio nunca vira "nenhum": só quando o paciente confirmou. */
export function fieldState(p: HealthProfile | null, f: EssentialField): FieldState {
  if (!p) return "nao_informado";
  if (filled(p, f)) return "preenchido";
  if ((NONE_FIELDS as readonly string[]).includes(f) && p.confirmed_none.includes(f as NoneField)) return "nenhum_confirmado";
  return "nao_informado";
}

/** Itens contados na completude, em ordem de importância clínica (IMC e idade derivam de outros). */
export const COMPLETION_ORDER = ["alergias", "medicamentos", "tipo_sanguineo", "condicoes", "contato_emergencia", "altura", "peso", "nascimento", "nome", "sexo", "cirurgias"] as const;
export type CompletionItem = (typeof COMPLETION_ORDER)[number];
const ITEM_FIELD: Record<CompletionItem, EssentialField> = {
  alergias: "alergias", medicamentos: "medicamentos", tipo_sanguineo: "tipo_sanguineo", condicoes: "condicoes", contato_emergencia: "contato_emergencia",
  altura: "altura", peso: "peso", nascimento: "idade", nome: "nome", sexo: "sexo", cirurgias: "cirurgias",
};
export const COMPLETION_TOTAL = 12;

/** Perfil "N de 12": os 11 itens acima + IMC (que conta quando altura e peso existem). */
export function completion(p: HealthProfile | null) {
  const faltando: CompletionItem[] = [];
  let feitos = 0;
  for (const item of COMPLETION_ORDER) {
    if (fieldState(p, ITEM_FIELD[item]) === "nao_informado") faltando.push(item); else feitos++;
  }
  if (p && fieldState(p, "imc") === "preenchido") feitos++;
  return { feitos, total: COMPLETION_TOTAL, percentual: Math.round((feitos / COMPLETION_TOTAL) * 100), faltando };
}

export type BmiRange = "abaixo" | "adequado" | "acima" | "bem_acima";
export const BMI_LABELS: Record<BmiRange, string> = { abaixo: "Abaixo da faixa de referência", adequado: "Dentro da faixa de referência", acima: "Acima da faixa de referência", bem_acima: "Bem acima da faixa de referência" };
/** IMC informativo (OMS, adultos). Não é diagnóstico. */
export function bmi(heightCm: number | null, weightKg: number | null): { value: number; range: BmiRange } | null {
  if (!heightCm || !weightKg || heightCm <= 0 || weightKg <= 0) return null;
  const value = Math.round((weightKg / (heightCm / 100) ** 2) * 10) / 10;
  const range: BmiRange = value < 18.5 ? "abaixo" : value < 25 ? "adequado" : value < 30 ? "acima" : "bem_acima";
  return { value, range };
}

export type PublicSource = { origem: FieldSource["origem"]; atualizado_em: string; por_nome?: string; documento_id?: string };
export type EssentialEntry = { field: EssentialField; label: string; state: FieldState; value: string; source: PublicSource | null; confirmedAt: string | null };
/** Origem sem o valor anterior (que fica só com o dono, para desfazer). */
const publicSource = (s: FieldSource | null): PublicSource | null => (s ? { origem: s.origem, atualizado_em: s.atualizado_em, ...(s.por_nome ? { por_nome: s.por_nome } : {}), ...(s.documento_id ? { documento_id: s.documento_id } : {}) } : null);

function display(p: HealthProfile, f: EssentialField): string {
  switch (f) {
    case "nome": return p.full_name.trim();
    case "idade": { const a = ageFromBirthDate(p.birth_date); return a === null ? "" : `${a} anos`; }
    case "sexo": return ({ feminino: "Feminino", masculino: "Masculino", outro: "Outro", prefiro_nao_informar: "Prefere não informar", "": "" } as const)[p.sex];
    case "altura": return p.height_cm ? `${p.height_cm} cm` : "";
    case "peso": return p.weight_kg ? `${p.weight_kg} kg` : "";
    case "imc": { const b = bmi(p.height_cm, p.weight_kg); return b ? `${b.value.toLocaleString("pt-BR")} · ${BMI_LABELS[b.range]}` : ""; }
    case "tipo_sanguineo": return p.blood_type;
    case "alergias": return p.allergies.trim();
    case "medicamentos": return p.medications.map((m) => [m.name, m.dose, m.frequency].filter(Boolean).join(" ")).join("; ");
    case "condicoes": return p.conditions.trim();
    case "cirurgias": return p.surgeries.trim();
    case "contato_emergencia": return p.emergency_contacts.map((c) => `${c.nome}${c.parentesco ? ` (${c.parentesco})` : ""} · ${c.telefone}`).join("; ");
  }
}

/** Fonte de um campo: a do primeiro campo de origem que tiver registro. */
export function sourceOf(p: HealthProfile, f: EssentialField): FieldSource | null {
  for (const col of FIELD_COLUMNS[f]) { const s = p.field_sources[col]; if (s) return s; }
  return null;
}

/** Só os campos autorizados no código; nada além disso sai do servidor. */
export function filterEssentials(p: HealthProfile | null, authorized: readonly string[]): EssentialEntry[] {
  return ESSENTIAL_FIELDS.filter((f) => authorized.includes(f)).map((f) => {
    const state = p ? fieldState(p, f) : "nao_informado";
    const src = p ? sourceOf(p, f) : null;
    return {
      field: f, label: ESSENTIAL_LABELS[f], state, value: p && state === "preenchido" ? display(p, f) : "",
      source: state === "preenchido" ? publicSource(src) : null,
      confirmedAt: state === "nenhum_confirmado" ? (p?.field_sources[`none:${f}`]?.atualizado_em ?? null) : null,
    };
  });
}

/** Colunas comparadas para registrar a origem de cada alteração. */
export const TRACKED_COLUMNS = ["full_name", "birth_date", "sex", "height_cm", "weight_kg", "blood_type", "allergies", "medications", "conditions", "surgeries", "emergency_contacts", "organ_donor", "family_history", "smoking", "alcohol", "activity"] as const satisfies readonly (keyof HealthProfile)[];

/**
 * Carimba a origem dos campos que mudaram. A origem enviada pelo navegador é ignorada:
 * só o servidor decide, a partir de quem salvou. Guarda o valor anterior para o dono poder desfazer.
 */
export function stampSources(prev: HealthProfile | null, next: HealthProfile, meta: { origem: FieldSource["origem"]; por_nome?: string; documento_id?: string }, now: Date = new Date()): HealthProfile["field_sources"] {
  const out: HealthProfile["field_sources"] = { ...(prev?.field_sources ?? {}) };
  const at = now.toISOString();
  for (const col of TRACKED_COLUMNS) {
    const before = prev ? prev[col] : undefined;
    if (JSON.stringify(before ?? null) === JSON.stringify(next[col] ?? null)) continue;
    out[col] = { origem: meta.origem, atualizado_em: at, ...(meta.por_nome ? { por_nome: meta.por_nome } : {}), ...(meta.documento_id ? { documento_id: meta.documento_id } : {}), ...(meta.origem === "cuidador" ? { anterior: before ?? null } : {}) };
  }
  for (const f of NONE_FIELDS) {
    const had = prev?.confirmed_none.includes(f) ?? false;
    const has = next.confirmed_none.includes(f);
    if (has && !had) out[`none:${f}`] = { origem: meta.origem, atualizado_em: at, ...(meta.por_nome ? { por_nome: meta.por_nome } : {}) };
    if (!has && had) delete out[`none:${f}`];
  }
  return out;
}

/** Preencher um campo desfaz o "não tenho" dele. */
export function clearNoneWhenFilled(p: HealthProfile): HealthProfile {
  return { ...p, confirmed_none: p.confirmed_none.filter((f) => fieldState({ ...p, confirmed_none: [] }, f) !== "preenchido") };
}

/** Dispensas do cartão em /inicio: depois de 2, some por 30 dias. */
export function completionCardHidden(dismissals: string[], now: Date = new Date()): boolean {
  const recent = dismissals.map((d) => new Date(d).getTime()).filter((t) => Number.isFinite(t)).sort((a, b) => b - a);
  if (recent.length < 2) return false;
  return now.getTime() - (recent[0] ?? 0) < 30 * 86_400_000;
}
