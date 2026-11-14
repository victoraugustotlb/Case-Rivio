// Adaptador Junction (agregador: Apple Saúde, Health Connect, Garmin, Fitbit, Oura, Whoop, Polar). Só servidor.
import type { Source } from "@/lib/wearables";
import type { Ligacao, WearableProvider, WebhookResult } from "./types";
import { JUNCTION_SLUG, mapJunctionEvent, verifySvix } from "./junction-map";

function baseUrl() {
  return process.env["JUNCTION_ENV"] === "production" ? "https://api.us.junction.com" : "https://api.sandbox.us.junction.com";
}
async function call(path: string, init: RequestInit = {}) {
  const res = await fetch(`${baseUrl()}${path}`, { ...init, headers: { "x-vital-api-key": process.env["JUNCTION_API_KEY"]!, "Content-Type": "application/json", Accept: "application/json", ...(init.headers ?? {}) } });
  const json = (await res.json().catch(() => ({}))) as Record<string, any>;
  return { ok: res.ok, status: res.status, json };
}

export const junctionProvider: WearableProvider = {
  id: "junction",
  enabled: () => !!process.env["JUNCTION_API_KEY"] && !!process.env["JUNCTION_WEBHOOK_SECRET"],
  async criarLigacao(userId: string, source: Source): Promise<Ligacao> {
    let u = await call("/v2/user/", { method: "POST", body: JSON.stringify({ client_user_id: userId }) });
    let externalUserId = u.json["user_id"] as string | undefined;
    if (!u.ok && u.status === 400 && u.json["detail"]?.["user_id"]) externalUserId = u.json["detail"]["user_id"];
    if (!externalUserId) { u = await call(`/v2/user/resolve/${encodeURIComponent(userId)}`); externalUserId = u.json["user_id"]; }
    if (!externalUserId) throw new Error("Não foi possível criar o usuário no provedor.");
    if (source === "apple_health" || source === "health_connect") {
      const c = await call(`/v2/link/code/create?user_id=${encodeURIComponent(externalUserId)}`, { method: "POST" });
      if (!c.ok || !c.json["code"]) throw new Error("Não foi possível gerar o código de pareamento.");
      return { kind: "codigo", code: String(c.json["code"]), expiresAt: (c.json["exp_at"] as string) ?? null, externalUserId };
    }
    const t = await call("/v2/link/token", { method: "POST", body: JSON.stringify({ user_id: externalUserId, provider: JUNCTION_SLUG[source] }) });
    const url = t.json["link_web_url"] as string | undefined;
    if (!t.ok || !url) throw new Error("Não foi possível abrir a autorização do provedor.");
    return { kind: "link", url, externalUserId };
  },
  async tratarWebhook(req: Request): Promise<WebhookResult> {
    const secret = process.env["JUNCTION_WEBHOOK_SECRET"];
    if (!secret) return { ok: false, status: 503 };
    const body = await req.text(); // texto bruto, só interpretado depois da assinatura conferida
    const valid = await verifySvix(secret, { id: req.headers.get("svix-id"), timestamp: req.headers.get("svix-timestamp"), signature: req.headers.get("svix-signature") }, body, new Date());
    if (!valid) return { ok: false, status: 401 };
    let ev: unknown;
    try { ev = JSON.parse(body); } catch { return { ok: false, status: 400 }; }
    return { ok: true, ...mapJunctionEvent(ev) };
  },
};
