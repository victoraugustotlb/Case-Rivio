// Dados fictícios de demonstração.
export type DocKind = "Exame" | "Laudo" | "Consulta" | "Receita" | "Vacina";
export type VitaDoc = { id: string; title: string; kind: DocKind; date: string; source: string; origin: "Escaneado" | "Arquivo" | "Laboratório"; confirmed: boolean; fields: { label: string; value: string }[] };

export const docs: VitaDoc[] = [
  { id: "hemograma-2026-11", title: "Hemograma completo", kind: "Exame", date: "11/11/2026", source: "Laboratório Vida", origin: "Laboratório", confirmed: true,
    fields: [{ label: "Hemoglobina", value: "13,8 g/dL" }, { label: "Leucócitos", value: "6.200 /mm³" }, { label: "Plaquetas", value: "245.000 /mm³" }] },
  { id: "colesterol-2026-08", title: "Perfil lipídico", kind: "Exame", date: "22/08/2026", source: "Laboratório Vida", origin: "Arquivo", confirmed: true,
    fields: [{ label: "Colesterol total", value: "212 mg/dL" }, { label: "LDL", value: "138 mg/dL" }, { label: "HDL", value: "48 mg/dL" }] },
  { id: "eco-2026-06", title: "Ecocardiograma", kind: "Laudo", date: "03/06/2026", source: "Clínica CardioSul", origin: "Escaneado", confirmed: true,
    fields: [{ label: "Fração de ejeção", value: "64%" }, { label: "Conclusão", value: "Sem alterações relevantes" }] },
  { id: "consulta-2025-12", title: "Consulta cardiologia", kind: "Consulta", date: "10/12/2025", source: "Dra. Helena Prado", origin: "Escaneado", confirmed: true,
    fields: [{ label: "Motivo", value: "Acompanhamento de pressão" }, { label: "Conduta", value: "Losartana 50 mg/dia" }] },
  { id: "receita-2025-12", title: "Receita — Losartana 50 mg", kind: "Receita", date: "10/12/2025", source: "Dra. Helena Prado", origin: "Escaneado", confirmed: false,
    fields: [{ label: "Medicamento", value: "Losartana 50 mg" }, { label: "Posologia", value: "1 comprimido ao dia" }] },
  { id: "vacina-2026-10", title: "Influenza 2026", kind: "Vacina", date: "28/10/2026", source: "UBS Centro", origin: "Arquivo", confirmed: true,
    fields: [{ label: "Lote", value: "FLU2611B" }, { label: "Dose", value: "Única" }] },
];

export const devices = [
  { name: "Apple Watch", what: "Frequência cardíaca, sono, passos, SpO₂", synced: "há 12 min", ok: true },
  { name: "Medidor de pressão Omron", what: "Pressão arterial", synced: "hoje, 08:10", ok: true },
  { name: "Glicosímetro Accu-Chek", what: "Glicose", synced: "há 9 dias", ok: false },
];

export const heartRate7d = [72, 75, 71, 78, 74, 70, 74];
