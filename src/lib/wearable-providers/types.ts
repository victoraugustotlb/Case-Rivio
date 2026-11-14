import type { Source } from "@/lib/wearables";

/** Resultado de iniciar uma conexão: link de autorização no navegador ou código para o app de pareamento. */
export type Ligacao = { kind: "link"; url: string; externalUserId: string } | { kind: "codigo"; code: string; expiresAt: string | null; externalUserId: string };

export type WebhookResult =
  | { ok: false; status: number }
  | { ok: true; clientUserId: string | null; externalUserId: string | null; source: Source | null; device: string; readings: { metric: string; value: number; unit: string; measured_at: string; external_id?: string }[]; connectionEvent: "created" | "error" | null };

/** Fonte externa de dados de dispositivo (agregador). Troque ou acrescente adaptadores aqui. */
export interface WearableProvider {
  id: "junction";
  enabled(): boolean;
  criarLigacao(userId: string, source: Source): Promise<Ligacao>;
  tratarWebhook(req: Request): Promise<WebhookResult>;
}
