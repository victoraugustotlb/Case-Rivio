// Tipos e listas fixas de documentos. Nenhum dado de exemplo: dispositivos vêm só de leituras reais.
export type DocKind = "Exame" | "Laudo" | "Consulta" | "Receita" | "Vacina";
export const DOC_KINDS: DocKind[] = ["Exame", "Laudo", "Consulta", "Receita", "Vacina"];
export type DocField = { label: string; value: string };
