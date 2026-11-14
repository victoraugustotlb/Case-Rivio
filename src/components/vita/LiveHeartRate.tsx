import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bluetooth, HeartPulse, Loader2, RefreshCw, WifiOff } from "lucide-react";
import { BLE_SAVE_EVERY_MS, freshness, parseHeartRateMeasurement } from "@/lib/wearables";
import { recordBleReading } from "@/lib/wearables.functions";
import { MiniChart } from "@/components/vita/WearableCharts";

// Tipos mínimos do Web Bluetooth (não fazem parte do lib.dom padrão).
type Char = EventTarget & { value?: DataView; startNotifications(): Promise<Char> };
type Device = EventTarget & { name?: string; gatt?: { connected: boolean; connect(): Promise<{ getPrimaryService(s: string): Promise<{ getCharacteristic(c: string): Promise<Char> }> }>; disconnect(): void } };
type BT = { requestDevice(o: unknown): Promise<Device> };

export function LiveHeartRate() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [state, setState] = useState<"idle" | "connecting" | "live" | "lost" | "error">("idle");
  const [points, setPoints] = useState<{ t: number; v: number }[]>([]);
  const [now, setNow] = useState(Date.now());
  const [msg, setMsg] = useState("");
  const device = useRef<Device | null>(null);
  const lastSaved = useRef(0);
  const save = useServerFn(recordBleReading);

  useEffect(() => { setSupported(typeof navigator !== "undefined" && "bluetooth" in navigator); }, []);
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);
  useEffect(() => () => { device.current?.gatt?.disconnect(); }, []);

  async function attach(d: Device) {
    setState("connecting");
    const server = await d.gatt!.connect();
    const svc = await server.getPrimaryService("heart_rate");
    const ch = await svc.getCharacteristic("heart_rate_measurement");
    ch.addEventListener("characteristicvaluechanged", (e) => {
      const v = (e.target as Char).value; if (!v) return;
      const bpm = parseHeartRateMeasurement(v); const t = Date.now();
      setPoints((p) => [...p.filter((x) => t - x.t <= 60_000), { t, v: bpm }]);
      setState("live");
      if (t - lastSaved.current >= BLE_SAVE_EVERY_MS) {
        lastSaved.current = t;
        save({ data: { bpm, measured_at: new Date(t).toISOString(), device: d.name || "Cinta cardíaca" } }).catch(() => setMsg("Não foi possível salvar a última leitura."));
      }
    });
    await ch.startNotifications();
  }

  async function connect() {
    setMsg("");
    try {
      const bt = (navigator as unknown as { bluetooth: BT }).bluetooth;
      const d = await bt.requestDevice({ filters: [{ services: ["heart_rate"] }] });
      device.current = d;
      d.addEventListener("gattserverdisconnected", () => setState("lost"));
      await attach(d);
    } catch (e) {
      if ((e as Error).name === "NotFoundError") { setState("idle"); return; }
      setState("error"); setMsg("Não foi possível conectar. Verifique se a cinta está ligada e perto.");
    }
  }
  async function reconnect() { if (!device.current) return connect(); try { await attach(device.current); } catch { setState("lost"); } }

  const last = points[points.length - 1];
  const live = !!last && freshness(new Date(last.t), new Date(now), "ble_hr").kind === "ao_vivo";

  if (supported === false) return <p className="rounded-xl border bg-muted p-4 text-sm">Este navegador não permite pareamento por Bluetooth. No iPhone, use o app de pareamento do Apple Watch.</p>;
  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <HeartPulse className="h-8 w-8 text-brand-teal" aria-hidden />
          <div>
            <p className="font-display text-4xl font-extrabold tabular-nums">{last ? last.v : "—"} <span className="text-base font-semibold text-muted-foreground">bpm</span></p>
            {live ? <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-xs font-semibold text-success"><span className="h-2 w-2 rounded-full bg-success" aria-hidden />Ao vivo</span>
              : last ? <span className="text-xs text-muted-foreground">Sem leitura nos últimos 5 s</span> : <span className="text-xs text-muted-foreground">Nenhuma leitura ainda</span>}
          </div>
        </div>
        {state === "lost" ? (
          <div className="flex items-center gap-2"><span role="status" className="inline-flex items-center gap-1 text-sm font-medium text-destructive"><WifiOff className="h-4 w-4" aria-hidden />Conexão perdida</span>
            <button type="button" onClick={reconnect} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"><RefreshCw className="h-4 w-4" aria-hidden />Reconectar</button></div>
        ) : state !== "live" && (
          <button type="button" onClick={connect} disabled={state === "connecting" || supported === null} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {state === "connecting" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Bluetooth className="h-4 w-4" aria-hidden />}Parear cinta cardíaca
          </button>
        )}
      </div>
      <MiniChart points={points} height={80} className="mt-4" />
      <p className="mt-2 text-xs text-muted-foreground">Últimos 60 s. Uma leitura é salva no seu histórico a cada 15 s.</p>
      {msg && <p role="alert" className="mt-2 text-sm text-destructive">{msg}</p>}
    </div>
  );
}
