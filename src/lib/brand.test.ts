import { describe, expect, it } from "vitest";
import { BRAND_HEX, BRAND_PAIRS, contrastRatio, MIN_RATIO, pairPasses } from "./brand";

describe("contraste da marca", () => {
  it("contrastRatio: preto/branco = 21 e cor/ela mesma = 1", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrastRatio("#002860", "#002860")).toBe(1);
  });
  for (const { fg, bg, use } of BRAND_PAIRS) {
    it(`${fg} sobre ${bg} ≥ ${MIN_RATIO[use]}:1`, () => {
      expect(contrastRatio(BRAND_HEX[fg], BRAND_HEX[bg])).toBeGreaterThanOrEqual(MIN_RATIO[use]);
    });
  }
  it("brand-teal não serve para texto pequeno (sobre fundo ou branco)", () => {
    expect(pairPasses("brandTeal", "background", "texto")).toBe(false);
    expect(pairPasses("brandTeal", "white", "texto")).toBe(false);
    expect(BRAND_PAIRS.some((p) => p.fg === "brandTeal" && p.use === "texto")).toBe(false);
  });
});
