// Cores da marca Anamedis em hex, equivalentes aos tokens oklch de src/styles.css (modo claro).
// Usadas só para conferir contraste em brand.test.ts; componentes usam sempre os tokens.
export const BRAND_HEX = {
  foreground: "#0c2345",
  background: "#f7fbfc",
  primary: "#002860",
  primaryForeground: "#f7fbfc",
  muted: "#eaf4f8",
  mutedForeground: "#49596e",
  accent: "#e0f5f5",
  accentForeground: "#002860",
  brandBlue: "#045c90",
  brandTeal: "#00a0a0",
  brandTealStrong: "#01706f",
  brandTealSoft: "#e0f5f5",
  ring: "#00a0a0",
  sidebar: "#022453",
  sidebarForeground: "#e8f0f3",
  sidebarPrimary: "#7ad7d1",
  white: "#ffffff",
} as const;
export type BrandColor = keyof typeof BRAND_HEX;

/** Uso de um par: texto normal exige 4,5:1; ícone grande / contorno de foco exige 3:1 (WCAG AA). */
export type PairUse = "texto" | "grafico";
export const MIN_RATIO: Record<PairUse, number> = { texto: 4.5, grafico: 3 };

export const BRAND_PAIRS: { fg: BrandColor; bg: BrandColor; use: PairUse }[] = [
  { fg: "foreground", bg: "background", use: "texto" },
  { fg: "primaryForeground", bg: "primary", use: "texto" },
  { fg: "mutedForeground", bg: "background", use: "texto" },
  { fg: "mutedForeground", bg: "muted", use: "texto" },
  { fg: "brandTealStrong", bg: "background", use: "texto" },
  { fg: "accentForeground", bg: "accent", use: "texto" },
  { fg: "sidebarForeground", bg: "sidebar", use: "texto" },
  { fg: "sidebarPrimary", bg: "sidebar", use: "texto" },
  { fg: "white", bg: "brandTealStrong", use: "texto" },
  { fg: "ring", bg: "background", use: "grafico" },
  { fg: "brandTeal", bg: "background", use: "grafico" },
];

function luminance(hex: string): number {
  const n = parseInt(hex.replace("#", ""), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

/** Razão de contraste WCAG entre duas cores hex (1 a 21). */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a), lb = luminance(b);
  const hi = Math.max(la, lb), lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

export function pairPasses(fg: BrandColor, bg: BrandColor, use: PairUse): boolean {
  return contrastRatio(BRAND_HEX[fg], BRAND_HEX[bg]) >= MIN_RATIO[use];
}
