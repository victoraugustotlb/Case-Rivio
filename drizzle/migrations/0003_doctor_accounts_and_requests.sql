CREATE TABLE public.doctor_profiles (
  user_id uuid PRIMARY KEY DEFAULT auth.uid(),
  full_name text NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 120),
  crm text NOT NULL CHECK (crm ~ '^[0-9]{3,8}$'),
  uf text NOT NULL CHECK (uf ~ '^[A-Z]{2}$'),
  specialty text NOT NULL DEFAULT '' CHECK (char_length(specialty) <= 80),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.doctor_profiles TO authenticated;
GRANT ALL ON public.doctor_profiles TO service_role;
ALTER TABLE public.doctor_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "doctor reads own" ON public.doctor_profiles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "doctor inserts own" ON public.doctor_profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "doctor updates own" ON public.doctor_profiles FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL DEFAULT auth.uid(),
  code text NOT NULL CHECK (code ~ '^[0-9]{6}$'),
  categories text[] NOT NULL DEFAULT '{}',
  signals text[] NOT NULL DEFAULT '{}',
  include_profile boolean NOT NULL DEFAULT false,
  period_months int NOT NULL CHECK (period_months IN (3,6,12,60)),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','authorized','declined','expired')),
  expected_patient_id uuid,
  patient_id uuid,
  share_code_id uuid,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX access_requests_pending_code ON public.access_requests(code) WHERE status = 'pending';
GRANT SELECT ON public.access_requests TO authenticated;
GRANT ALL ON public.access_requests TO service_role;
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "doctor reads own requests" ON public.access_requests FOR SELECT TO authenticated USING (doctor_id = auth.uid());

CREATE TABLE public.doctor_patients (
  doctor_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  patient_name text NOT NULL DEFAULT '',
  patient_ref text NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (doctor_id, patient_id)
);
GRANT SELECT ON public.doctor_patients TO authenticated;
GRANT ALL ON public.doctor_patients TO service_role;
ALTER TABLE public.doctor_patients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "doctor reads own patients" ON public.doctor_patients FOR SELECT TO authenticated USING (doctor_id = auth.uid());

CREATE TABLE public.request_attempts (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX request_attempts_user ON public.request_attempts(user_id, created_at);
GRANT ALL ON public.request_attempts TO service_role;
ALTER TABLE public.request_attempts ENABLE ROW LEVEL SECURITY;