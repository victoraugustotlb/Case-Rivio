CREATE TABLE public.family_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL,
  plan_id uuid NOT NULL REFERENCES public.insurance_plans(id),
  holder_card_number text NOT NULL,
  holder_id uuid,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','recusado')),
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);
CREATE INDEX family_requests_holder_idx ON public.family_requests(holder_id, status);
CREATE INDEX family_requests_requester_idx ON public.family_requests(requester_id, created_at DESC);
GRANT SELECT ON public.family_requests TO authenticated;
GRANT ALL ON public.family_requests TO service_role;
ALTER TABLE public.family_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Solicitante e titular veem o pedido" ON public.family_requests FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR holder_id = auth.uid());

CREATE TABLE public.family_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  viewer_id uuid NOT NULL,
  scope text NOT NULL DEFAULT 'tudo' CHECK (scope IN ('tudo','categorias')),
  categories text[] NOT NULL DEFAULT '{}',
  expires_at timestamptz,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','ativo','recusado','revogado')),
  revoked_at timestamptz,
  basis text NOT NULL DEFAULT 'consentimento' CHECK (basis IN ('consentimento','responsavel_legal')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (owner_id <> viewer_id)
);
CREATE INDEX family_grants_owner_idx ON public.family_access_grants(owner_id, status);
CREATE INDEX family_grants_viewer_idx ON public.family_access_grants(viewer_id, status);
GRANT SELECT ON public.family_access_grants TO authenticated;
GRANT ALL ON public.family_access_grants TO service_role;
ALTER TABLE public.family_access_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Dono e quem vê enxergam a autorização" ON public.family_access_grants FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR viewer_id = auth.uid());

ALTER TABLE public.access_logs ADD COLUMN viewer_id uuid;
ALTER TABLE public.access_logs ALTER COLUMN share_code_id DROP NOT NULL;
ALTER TABLE public.access_logs DROP CONSTRAINT IF EXISTS access_logs_action_check;
ALTER TABLE public.access_logs ADD CONSTRAINT access_logs_action_check CHECK (action IN ('resumo','documento','familia_resumo','familia_documento'));
ALTER TABLE public.access_logs ADD CONSTRAINT access_logs_origin_check CHECK (share_code_id IS NOT NULL OR viewer_id IS NOT NULL);