CREATE TABLE public.wearable_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL CHECK (provider IN ('junction','ingest_api','web_bluetooth')),
  source text NOT NULL CHECK (source IN ('apple_health','health_connect','garmin','fitbit','oura','whoop','polar','ble_hr','outro')),
  display_name text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','connected','error','revoked')),
  external_user_id text,
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX wearable_connections_user_idx ON public.wearable_connections (user_id);
GRANT SELECT ON public.wearable_connections TO authenticated;
GRANT UPDATE (status) ON public.wearable_connections TO authenticated;
GRANT ALL ON public.wearable_connections TO service_role;
ALTER TABLE public.wearable_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Dono lê conexões" ON public.wearable_connections FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Dono só revoga" ON public.wearable_connections FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id AND status = 'revoked');

CREATE TABLE public.wearable_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  connection_id uuid REFERENCES public.wearable_connections(id) ON DELETE CASCADE,
  metric text NOT NULL CHECK (metric IN ('heart_rate','resting_heart_rate','hrv','spo2','steps','sleep_minutes','bp_systolic','bp_diastolic','glucose','weight','temperature')),
  value numeric NOT NULL,
  unit text NOT NULL,
  measured_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  source_device text NOT NULL DEFAULT '',
  external_id text
);
CREATE UNIQUE INDEX wearable_readings_dedupe ON public.wearable_readings (user_id, metric, measured_at, source_device);
CREATE INDEX wearable_readings_user_metric_time ON public.wearable_readings (user_id, metric, measured_at DESC);
GRANT SELECT, DELETE ON public.wearable_readings TO authenticated;
GRANT ALL ON public.wearable_readings TO service_role;
ALTER TABLE public.wearable_readings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Dono lê leituras" ON public.wearable_readings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Dono apaga leituras" ON public.wearable_readings FOR DELETE TO authenticated USING (auth.uid() = user_id);
ALTER PUBLICATION supabase_realtime ADD TABLE public.wearable_readings;

CREATE TABLE public.wearable_ingest_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  label text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  window_start timestamptz NOT NULL DEFAULT now(),
  window_count integer NOT NULL DEFAULT 0
);
CREATE INDEX wearable_ingest_tokens_user_idx ON public.wearable_ingest_tokens (user_id);
GRANT SELECT (id, user_id, label, last_used_at, revoked_at, created_at) ON public.wearable_ingest_tokens TO authenticated;
GRANT ALL ON public.wearable_ingest_tokens TO service_role;
ALTER TABLE public.wearable_ingest_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Dono lê tokens" ON public.wearable_ingest_tokens FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Conta uma chamada do token na janela de 1 minuto, de forma atômica.
CREATE OR REPLACE FUNCTION public.wearable_token_hit(_hash text, _limit integer)
RETURNS TABLE (token_id uuid, owner uuid, revoked boolean, allowed boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.wearable_ingest_tokens;
BEGIN
  SELECT * INTO t FROM public.wearable_ingest_tokens WHERE token_hash = _hash FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF t.revoked_at IS NOT NULL THEN
    RETURN QUERY SELECT t.id, t.user_id, true, false; RETURN;
  END IF;
  IF t.window_start < now() - interval '1 minute' THEN
    UPDATE public.wearable_ingest_tokens SET window_start = now(), window_count = 1, last_used_at = now() WHERE id = t.id;
    RETURN QUERY SELECT t.id, t.user_id, false, true; RETURN;
  END IF;
  IF t.window_count >= _limit THEN
    RETURN QUERY SELECT t.id, t.user_id, false, false; RETURN;
  END IF;
  UPDATE public.wearable_ingest_tokens SET window_count = window_count + 1, last_used_at = now() WHERE id = t.id;
  RETURN QUERY SELECT t.id, t.user_id, false, true;
END $$;
REVOKE ALL ON FUNCTION public.wearable_token_hit(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wearable_token_hit(text, integer) TO service_role;

ALTER TABLE public.access_logs DROP CONSTRAINT access_logs_action_check;
ALTER TABLE public.access_logs ADD CONSTRAINT access_logs_action_check CHECK (action = ANY (ARRAY['resumo','documento','familia_resumo','familia_documento','profissional_historico','profissional_documento','profissional_envio','sinais','profissional_sinais']));