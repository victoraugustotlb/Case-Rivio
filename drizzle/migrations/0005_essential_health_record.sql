ALTER TABLE public.patient_profiles
  ADD COLUMN IF NOT EXISTS blood_type text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sex text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS emergency_contacts jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS organ_donor text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS confirmed_none text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS field_sources jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE public.patient_settings (
  user_id uuid PRIMARY KEY,
  default_share_essentials boolean NOT NULL DEFAULT true,
  essentials_fields text[] NOT NULL DEFAULT ARRAY['nome','idade','sexo','altura','peso','imc','tipo_sanguineo','alergias','medicamentos','condicoes','cirurgias','contato_emergencia'],
  large_text boolean NOT NULL DEFAULT false,
  guided_mode boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.patient_settings TO authenticated;
GRANT ALL ON public.patient_settings TO service_role;
ALTER TABLE public.patient_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Dono lê configurações" ON public.patient_settings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Dono cria configurações" ON public.patient_settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Dono altera configurações" ON public.patient_settings FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.profile_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  field text NOT NULL,
  value jsonb NOT NULL,
  source_document_id uuid,
  excerpt text NOT NULL DEFAULT '',
  confidence numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','dismissed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX profile_suggestions_user_idx ON public.profile_suggestions (user_id, status);
GRANT SELECT ON public.profile_suggestions TO authenticated;
GRANT UPDATE (status) ON public.profile_suggestions TO authenticated;
GRANT ALL ON public.profile_suggestions TO service_role;
ALTER TABLE public.profile_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Dono lê sugestões" ON public.profile_suggestions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Dono muda status" ON public.profile_suggestions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.share_codes
  ADD COLUMN IF NOT EXISTS include_essentials boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS essentials_fields text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.share_codes ALTER COLUMN include_essentials SET DEFAULT true;
ALTER TABLE public.access_requests
  ADD COLUMN IF NOT EXISTS include_essentials boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS essentials_fields text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.access_requests ALTER COLUMN include_essentials SET DEFAULT true;

ALTER TABLE public.family_access_grants ADD COLUMN IF NOT EXISTS can_edit_profile boolean NOT NULL DEFAULT false;