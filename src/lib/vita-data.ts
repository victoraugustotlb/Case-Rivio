// Dados fictícios apenas dos dispositivos (wearables). Documentos vêm do banco.
export type DocKind = "Exame" | "Laudo" | "Consulta" | "Receita" | "Vacina";
export const DOC_KINDS: DocKind[] = ["Exame", "Laudo", "Consulta", "Receita", "Vacina"];
export type DocField = { label: string; value: string };

export const devices = [
  { name: "Apple Watch", what: "Frequência cardíaca, sono, passos, SpO₂", synced: "há 12 min", ok: true },
  { name: "Medidor de pressão Omron", what: "Pressão arterial", synced: "hoje, 08:10", ok: true },
  { name: "Glicosímetro Accu-Chek", what: "Glicose", synced: "há 9 dias", ok: false },
];

export const heartRate7d = [72, 75, 71, 78, 74, 70, 74];
