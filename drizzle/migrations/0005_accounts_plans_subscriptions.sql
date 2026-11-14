CREATE TABLE public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  account_type text NOT NULL DEFAULT 'patient_individual' CHECK (account_type IN ('patient_plan','patient_individual','doctor','laboratory')),
  billing_exempt boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuário lê o próprio tipo de conta" ON public.profiles FOR SELECT TO authenticated USING (user_id = auth.uid());

INSERT INTO public.profiles (user_id, account_type, billing_exempt)
SELECT x.id, x.t, x.t = 'patient_individual' FROM (
  SELECT u.id,
    CASE WHEN EXISTS (SELECT 1 FROM public.doctor_profiles d WHERE d.user_id = u.id) OR COALESCE(u.raw_user_meta_data->>'account_type','') = 'doctor' THEN 'doctor' ELSE 'patient_individual' END AS t
  FROM auth.users u) x
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.handle_new_account()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t text := NEW.raw_user_meta_data->>'account_type';
BEGIN
  IF t IS NULL OR t NOT IN ('patient_plan','patient_individual','doctor','laboratory') THEN t := 'patient_individual'; END IF;
  INSERT INTO public.profiles (user_id, account_type) VALUES (NEW.id, t) ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created_account AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_account();

CREATE TABLE public.insurance_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  is_demo boolean NOT NULL DEFAULT false
);
GRANT SELECT ON public.insurance_plans TO authenticated;
GRANT ALL ON public.insurance_plans TO service_role;
ALTER TABLE public.insurance_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operadoras ativas visíveis a usuários conectados" ON public.insurance_plans FOR SELECT TO authenticated USING (active);
INSERT INTO public.insurance_plans (name, active, is_demo) VALUES ('Plano Saúde Exemplo', true, true);

CREATE TABLE public.plan_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  plan_id uuid NOT NULL REFERENCES public.insurance_plans(id),
  card_number text NOT NULL,
  role text NOT NULL CHECK (role IN ('titular','dependente')),
  holder_card_number text,
  status text NOT NULL CHECK (status IN ('active','pending','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, card_number),
  CHECK (role = 'titular' OR holder_card_number IS NOT NULL)
);
GRANT SELECT ON public.plan_memberships TO authenticated;
GRANT ALL ON public.plan_memberships TO service_role;
ALTER TABLE public.plan_memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuário lê o próprio vínculo" ON public.plan_memberships FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.plan_attempts (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX plan_attempts_user_idx ON public.plan_attempts(user_id, created_at DESC);
GRANT ALL ON public.plan_attempts TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.plan_attempts_id_seq TO service_role;
ALTER TABLE public.plan_attempts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.subscriptions (
  user_id uuid PRIMARY KEY,
  provider_customer_id text,
  provider_subscription_id text,
  status text NOT NULL DEFAULT 'incomplete',
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  environment text NOT NULL DEFAULT 'sandbox',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuário lê a própria assinatura" ON public.subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.lab_profiles (
  user_id uuid PRIMARY KEY DEFAULT auth.uid(),
  legal_name text NOT NULL CHECK (char_length(legal_name) BETWEEN 2 AND 200),
  cnpj text NOT NULL CHECK (cnpj ~ '^\d{14}$'),
  tech_lead_name text NOT NULL CHECK (char_length(tech_lead_name) BETWEEN 2 AND 150),
  tech_lead_registry text NOT NULL CHECK (char_length(tech_lead_registry) BETWEEN 2 AND 40),
  city text NOT NULL CHECK (char_length(city) BETWEEN 2 AND 100),
  uf text NOT NULL CHECK (uf ~ '^[A-Z]{2}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.lab_profiles TO authenticated;
GRANT ALL ON public.lab_profiles TO service_role;
ALTER TABLE public.lab_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Laboratório lê o próprio cadastro" ON public.lab_profiles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Laboratório cria o próprio cadastro" ON public.lab_profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Laboratório atualiza o próprio cadastro" ON public.lab_profiles FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.can_write_records(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.user_id = _uid AND (
      (p.account_type = 'patient_plan' AND EXISTS (SELECT 1 FROM public.plan_memberships m WHERE m.user_id = _uid AND m.status = 'active'))
      OR (p.account_type = 'patient_individual' AND (p.billing_exempt OR EXISTS (
        SELECT 1 FROM public.subscriptions s WHERE s.user_id = _uid
          AND s.status IN ('active','trialing','past_due') AND (s.current_period_end IS NULL OR s.current_period_end > now()))))
    )
  )
$$;
GRANT EXECUTE ON FUNCTION public.can_write_records(uuid) TO authenticated;

CREATE POLICY "Envio exige acesso em dia" ON public.documents AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.can_write_records(auth.uid()));
CREATE POLICY "Códigos exigem acesso em dia" ON public.share_codes AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.can_write_records(auth.uid()));