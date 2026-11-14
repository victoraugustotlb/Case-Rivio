// Único lugar com o preço da assinatura individual. Ajuste aqui.
export const INDIVIDUAL_PLAN = {
  priceCents: 1990,
  currency: "BRL",
  interval: "mês",
  label: "Assinatura individual",
} as const;

export function formatPrice(cents: number = INDIVIDUAL_PLAN.priceCents): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: INDIVIDUAL_PLAN.currency });
}
