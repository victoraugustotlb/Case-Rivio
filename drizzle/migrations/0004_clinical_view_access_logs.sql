ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS file_hash text;
CREATE TABLE public.access_logs (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL,
  share_code_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('resumo','documento')),
  document_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX access_logs_user_idx ON public.access_logs(user_id, created_at DESC);
GRANT SELECT ON public.access_logs TO authenticated;
GRANT ALL ON public.access_logs TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.access_logs_id_seq TO service_role;
ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Paciente vê os acessos ao próprio histórico" ON public.access_logs FOR SELECT TO authenticated USING (user_id = auth.uid());