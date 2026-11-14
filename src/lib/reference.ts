// Compara um resultado com a referência impressa no laudo. Função pura, testada em reference.test.ts.
// Não é diagnóstico: só lê o texto que o próprio documento traz.
export type RefStatus = "normal" | "acima" | "abaixo" | "indeterminado";
export type RefReading = { status: RefStatus; value: number | null; min: number | null; max: number | null };

const NUM = String.raw`(\d+(?:[.,]\d+)?)`;
const toNum = (s: string): number => {
  // "1.250" (milhar) vs "1,5" / "1.5" (decimal)
  const t = /^\d{1,3}\.\d{3}$/.test(s) ? s.replace(".", "") : s.replace(",", ".");
  return Number(t);
};
const none: RefReading = { status: "indeterminado", value: null, min: null, max: null };

export function parseReference(text: string): RefReading {
  const t = text.toLowerCase().replace(/\s+/g, " ").trim();
  const valueMatch = t.match(new RegExp(`^[^\\d<>]*?${NUM}`));
  if (!valueMatch?.[1]) return none;
  const value = toNum(valueMatch[1]);
  const rest = t.slice((valueMatch.index ?? 0) + valueMatch[0].length);
  let min: number | null = null;
  let max: number | null = null;
  let m: RegExpMatchArray | null;
  if ((m = rest.match(new RegExp(`${NUM}\\s*(?:a|até|-|–|e)\\s*${NUM}`)))) { min = toNum(m[1]!); max = toNum(m[2]!); }
  else if ((m = rest.match(new RegExp(`(?:inferior a|menor que|menor ou igual a|até|abaixo de|<=?|≤)\\s*${NUM}`)))) max = toNum(m[1]!);
  else if ((m = rest.match(new RegExp(`(?:superior a|maior que|maior ou igual a|acima de|>=?|≥)\\s*${NUM}`)))) min = toNum(m[1]!);
  if (min === null && max === null) return { ...none, value };
  if (Number.isNaN(value) || (min !== null && max !== null && min > max)) return none;
  const status: RefStatus = max !== null && value > max ? "acima" : min !== null && value < min ? "abaixo" : "normal";
  return { status, value, min, max };
}

export const REFERENCE_NOTE = "Comparação com a referência impressa no laudo. Não é diagnóstico.";
