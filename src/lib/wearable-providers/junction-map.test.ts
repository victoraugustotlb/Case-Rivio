import { describe, expect, it } from "vitest";
import { mapJunctionEvent, svixSignature, verifySvix } from "./junction-map";

const heartrate = {
  event_type: "daily.data.heartrate.created",
  user_id: "4eca10f9-junction",
  client_user_id: "59efcf34-paciente",
  team_id: "t1",
  data: {
    user_id: "4eca10f9-junction",
    source: { provider: "oura", type: "ring", name: "Oura Ring" },
    data: [
      { id: 1, timestamp: "2026-11-14T10:00:00+00:00", value: 64, unit: "bpm", type: "automatic" },
      { id: 2, timestamp: "2026-11-14T10:05:00+00:00", value: 66, unit: "bpm", type: "automatic" },
    ],
  },
};

describe("mapJunctionEvent", () => {
  it("frequência cardíaca vira leituras heart_rate com paciente e fonte", () => {
    const m = mapJunctionEvent(heartrate);
    expect(m.clientUserId).toBe("59efcf34-paciente");
    expect(m.source).toBe("oura");
    expect(m.device).toBe("Oura Ring");
    expect(m.readings).toEqual([
      { metric: "heart_rate", value: 64, unit: "bpm", measured_at: "2026-11-14T10:00:00+00:00", external_id: 1 },
      { metric: "heart_rate", value: 66, unit: "bpm", measured_at: "2026-11-14T10:05:00+00:00", external_id: 2 },
    ]);
  });
  it("pressão gera sistólica e diastólica; glicose em mmol/L é convertida", () => {
    const bp = mapJunctionEvent({ event_type: "daily.data.blood_pressure.created", client_user_id: "u", data: { source: { provider: "apple_health_kit" }, data: [{ timestamp: "2026-11-14T08:00:00Z", systolic: 120, diastolic: 80 }] } });
    expect(bp.source).toBe("apple_health");
    expect(bp.readings.map((r) => [r.metric, r.value])).toEqual([["bp_systolic", 120], ["bp_diastolic", 80]]);
    const g = mapJunctionEvent({ event_type: "daily.data.glucose.created", client_user_id: "u", data: { data: [{ timestamp: "2026-11-14T08:00:00Z", value: 5.5, unit: "mmol/L" }] } });
    expect(g.readings[0]).toMatchObject({ metric: "glucose", value: 99, unit: "mg/dL" });
  });
  it("conexão criada e evento sem dados", () => {
    expect(mapJunctionEvent({ event_type: "provider.connection.created", client_user_id: "u", data: { provider: { slug: "garmin" } } })).toMatchObject({ connectionEvent: "created", source: "garmin", readings: [] });
    expect(mapJunctionEvent({ event_type: "historical.data.workouts.created", data: {} }).readings).toEqual([]);
  });
});

describe("assinatura do webhook (Svix)", () => {
  const secret = "whsec_" + btoa("segredo-de-teste-1234567890");
  const now = new Date("2026-11-14T12:00:00Z");
  const ts = String(Math.floor(now.getTime() / 1000));
  it("aceita assinatura válida e recusa corpo alterado, sem cabeçalho ou antiga", async () => {
    const body = JSON.stringify(heartrate);
    const sig = await svixSignature(secret, "msg_1", ts, body);
    expect(await verifySvix(secret, { id: "msg_1", timestamp: ts, signature: `v1,${sig}` }, body, now)).toBe(true);
    expect(await verifySvix(secret, { id: "msg_1", timestamp: ts, signature: `v1,${sig}` }, body + " ", now)).toBe(false);
    expect(await verifySvix(secret, { id: "msg_1", timestamp: ts, signature: null }, body, now)).toBe(false);
    expect(await verifySvix(secret, { id: "msg_1", timestamp: ts, signature: `v1,${sig}` }, body, new Date(now.getTime() + 600_000))).toBe(false);
  });
});
