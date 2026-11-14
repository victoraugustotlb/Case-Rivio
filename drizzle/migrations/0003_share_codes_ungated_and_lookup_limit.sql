DROP POLICY IF EXISTS "Códigos exigem acesso em dia" ON public.share_codes;

CREATE TABLE public.share_lookup_attempts (
  id bigserial PRIMARY KEY,
  ip_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.share_lookup_attempts TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.share_lookup_attempts_id_seq TO service_role;
ALTER TABLE public.share_lookup_attempts ENABLE ROW LEVEL SECURITY;
CREATE INDEX share_lookup_attempts_ip_time ON public.share_lookup_attempts (ip_hash, created_at DESC);
COMMENT ON TABLE public.share_lookup_attempts IS 'Failed patient-code lookups per hashed IP (never the raw IP); written only by server functions.';