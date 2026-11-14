CREATE TABLE public.providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('medico','clinica','laboratorio')),
  name text NOT NULL,
  specialties text[] NOT NULL DEFAULT '{}',
  address text NOT NULL DEFAULT '',
  city text NOT NULL,
  uf text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  telehealth boolean NOT NULL DEFAULT false,
  in_person boolean NOT NULL DEFAULT true,
  price_private numeric,
  user_id uuid,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.providers TO authenticated;
GRANT ALL ON public.providers TO service_role;
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Conectados leem profissionais" ON public.providers FOR SELECT TO authenticated USING (true);

CREATE TABLE public.provider_plans (
  provider_id uuid NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.insurance_plans(id) ON DELETE CASCADE,
  PRIMARY KEY (provider_id, plan_id)
);
GRANT SELECT ON public.provider_plans TO authenticated;
GRANT ALL ON public.provider_plans TO service_role;
ALTER TABLE public.provider_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Conectados leem convênios aceitos" ON public.provider_plans FOR SELECT TO authenticated USING (true);

CREATE TABLE public.availability_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  duration_min integer NOT NULL DEFAULT 30,
  booked boolean NOT NULL DEFAULT false,
  UNIQUE (provider_id, starts_at)
);
CREATE INDEX availability_slots_open_idx ON public.availability_slots (provider_id, starts_at) WHERE NOT booked;
GRANT SELECT ON public.availability_slots TO authenticated;
GRANT ALL ON public.availability_slots TO service_role;
ALTER TABLE public.availability_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Conectados leem horários" ON public.availability_slots FOR SELECT TO authenticated USING (true);

CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL DEFAULT auth.uid(),
  provider_id uuid NOT NULL REFERENCES public.providers(id),
  slot_id uuid NOT NULL REFERENCES public.availability_slots(id),
  status text NOT NULL DEFAULT 'agendado' CHECK (status IN ('agendado','cancelado','remarcado')),
  mode text NOT NULL CHECK (mode IN ('presencial','telemedicina')),
  coverage text NOT NULL DEFAULT 'particular' CHECK (coverage IN ('plano','particular')),
  share_code_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX appointments_one_active_per_slot ON public.appointments (slot_id) WHERE status = 'agendado';
GRANT SELECT ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Paciente e profissional dono leem" ON public.appointments FOR SELECT TO authenticated
  USING (patient_id = auth.uid() OR EXISTS (SELECT 1 FROM public.providers p WHERE p.id = provider_id AND p.user_id = auth.uid()));

-- Reserva atômica: trava a linha do horário; um único agendamento ativo por horário.
CREATE OR REPLACE FUNCTION public.book_slot(_slot uuid, _mode text, _coverage text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.availability_slots; pr public.providers; new_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'nao_autenticado'; END IF;
  SELECT * INTO s FROM public.availability_slots WHERE id = _slot FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'horario_inexistente'; END IF;
  IF s.booked THEN RAISE EXCEPTION 'horario_ocupado'; END IF;
  IF s.starts_at <= now() THEN RAISE EXCEPTION 'horario_passado'; END IF;
  SELECT * INTO pr FROM public.providers WHERE id = s.provider_id;
  IF _mode = 'telemedicina' AND NOT pr.telehealth THEN RAISE EXCEPTION 'modo_indisponivel'; END IF;
  IF _mode = 'presencial' AND NOT pr.in_person THEN RAISE EXCEPTION 'modo_indisponivel'; END IF;
  UPDATE public.availability_slots SET booked = true WHERE id = _slot;
  INSERT INTO public.appointments (patient_id, provider_id, slot_id, mode, coverage)
  VALUES (auth.uid(), s.provider_id, _slot, _mode, _coverage) RETURNING id INTO new_id;
  RETURN new_id;
END $$;

CREATE OR REPLACE FUNCTION public.cancel_appointment(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.appointments; s public.availability_slots;
BEGIN
  SELECT * INTO a FROM public.appointments WHERE id = _id AND patient_id = auth.uid() FOR UPDATE;
  IF NOT FOUND OR a.status <> 'agendado' THEN RAISE EXCEPTION 'agendamento_invalido'; END IF;
  SELECT * INTO s FROM public.availability_slots WHERE id = a.slot_id FOR UPDATE;
  IF s.starts_at - now() < interval '2 hours' THEN RAISE EXCEPTION 'prazo_encerrado'; END IF;
  UPDATE public.appointments SET status = 'cancelado' WHERE id = _id;
  UPDATE public.availability_slots SET booked = false WHERE id = a.slot_id;
END $$;

CREATE OR REPLACE FUNCTION public.reschedule_appointment(_id uuid, _new_slot uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.appointments; s public.availability_slots; n public.availability_slots; new_id uuid;
BEGIN
  SELECT * INTO a FROM public.appointments WHERE id = _id AND patient_id = auth.uid() FOR UPDATE;
  IF NOT FOUND OR a.status <> 'agendado' THEN RAISE EXCEPTION 'agendamento_invalido'; END IF;
  SELECT * INTO s FROM public.availability_slots WHERE id = a.slot_id FOR UPDATE;
  IF s.starts_at - now() < interval '2 hours' THEN RAISE EXCEPTION 'prazo_encerrado'; END IF;
  SELECT * INTO n FROM public.availability_slots WHERE id = _new_slot FOR UPDATE;
  IF NOT FOUND OR n.provider_id <> a.provider_id THEN RAISE EXCEPTION 'horario_inexistente'; END IF;
  IF n.booked THEN RAISE EXCEPTION 'horario_ocupado'; END IF;
  IF n.starts_at <= now() THEN RAISE EXCEPTION 'horario_passado'; END IF;
  UPDATE public.appointments SET status = 'remarcado' WHERE id = _id;
  UPDATE public.availability_slots SET booked = false WHERE id = a.slot_id;
  UPDATE public.availability_slots SET booked = true WHERE id = _new_slot;
  INSERT INTO public.appointments (patient_id, provider_id, slot_id, mode, coverage, share_code_id)
  VALUES (a.patient_id, a.provider_id, _new_slot, a.mode, a.coverage, a.share_code_id) RETURNING id INTO new_id;
  RETURN new_id;
END $$;

CREATE OR REPLACE FUNCTION public.attach_appointment_share(_id uuid, _share uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.share_codes WHERE id = _share AND user_id = auth.uid()) THEN RAISE EXCEPTION 'codigo_invalido'; END IF;
  UPDATE public.appointments SET share_code_id = _share WHERE id = _id AND patient_id = auth.uid() AND status = 'agendado';
END $$;

REVOKE ALL ON FUNCTION public.book_slot(uuid,text,text), public.cancel_appointment(uuid), public.reschedule_appointment(uuid,uuid), public.attach_appointment_share(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.book_slot(uuid,text,text), public.cancel_appointment(uuid), public.reschedule_appointment(uuid,uuid), public.attach_appointment_share(uuid,uuid) TO authenticated;

-- Dados de demonstração (is_demo = true)
INSERT INTO public.insurance_plans (id, name, active, is_demo) VALUES
 ('00000000-0000-4000-a000-000000000001','Saúde Exemplo (demonstração)',true,true),
 ('00000000-0000-4000-a000-000000000002','Vida Plena Fictícia (demonstração)',true,true),
 ('00000000-0000-4000-a000-000000000003','Cuidar Mais Demo (demonstração)',true,true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.providers (id, kind, name, specialties, address, city, uf, lat, lng, telehealth, in_person, price_private, is_demo) VALUES
 ('10000000-0000-4000-a000-000000000001','medico','Dra. Ana Exemplo','{Cardiologia}','Av. Paulista, 1000 — Bela Vista','São Paulo','SP',-23.5651,-46.6519,true,true,380,true),
 ('10000000-0000-4000-a000-000000000002','medico','Dr. Bruno Fictício','{Clínica geral}','R. Augusta, 500 — Consolação','São Paulo','SP',-23.5534,-46.6566,true,true,250,true),
 ('10000000-0000-4000-a000-000000000003','clinica','Clínica Demo Pinheiros','{Dermatologia,Clínica geral}','R. dos Pinheiros, 800 — Pinheiros','São Paulo','SP',-23.5660,-46.6870,false,true,320,true),
 ('10000000-0000-4000-a000-000000000004','medico','Dra. Carla Modelo','{Pediatria}','Av. Ibirapuera, 2000 — Moema','São Paulo','SP',-23.6010,-46.6630,true,true,300,true),
 ('10000000-0000-4000-a000-000000000005','medico','Dr. Daniel Teste','{Ortopedia}','R. Tuiuti, 1200 — Tatuapé','São Paulo','SP',-23.5400,-46.5760,false,true,420,true),
 ('10000000-0000-4000-a000-000000000006','laboratorio','Laboratório Demonstração Centro','{Exames laboratoriais}','R. Direita, 100 — Sé','São Paulo','SP',-23.5480,-46.6350,false,true,90,true),
 ('10000000-0000-4000-a000-000000000007','medico','Dra. Elisa Amostra','{Ginecologia}','Av. Afonso Pena, 1500 — Centro','Belo Horizonte','MG',-19.9245,-43.9352,true,true,330,true),
 ('10000000-0000-4000-a000-000000000008','medico','Dr. Fábio Fictício','{Cardiologia}','R. da Bahia, 900 — Lourdes','Belo Horizonte','MG',-19.9308,-43.9420,true,true,360,true),
 ('10000000-0000-4000-a000-000000000009','clinica','Clínica Exemplo Savassi','{Clínica geral,Pediatria}','R. Pernambuco, 700 — Savassi','Belo Horizonte','MG',-19.9370,-43.9340,true,true,240,true),
 ('10000000-0000-4000-a000-000000000010','medico','Dra. Gabriela Demo','{Dermatologia}','Av. do Contorno, 5000 — Funcionários','Belo Horizonte','MG',-19.9400,-43.9300,false,true,350,true),
 ('10000000-0000-4000-a000-000000000011','medico','Dr. Henrique Modelo','{Psiquiatria}','Atendimento somente on-line','Belo Horizonte','MG',-19.9167,-43.9345,true,false,400,true),
 ('10000000-0000-4000-a000-000000000012','laboratorio','Laboratório Fictício Pampulha','{Exames laboratoriais}','Av. Otacílio Negrão de Lima, 3000 — Pampulha','Belo Horizonte','MG',-19.8580,-43.9780,false,true,80,true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.provider_plans (provider_id, plan_id) VALUES
 ('10000000-0000-4000-a000-000000000001','00000000-0000-4000-a000-000000000001'),
 ('10000000-0000-4000-a000-000000000001','00000000-0000-4000-a000-000000000002'),
 ('10000000-0000-4000-a000-000000000002','00000000-0000-4000-a000-000000000001'),
 ('10000000-0000-4000-a000-000000000003','00000000-0000-4000-a000-000000000003'),
 ('10000000-0000-4000-a000-000000000004','00000000-0000-4000-a000-000000000001'),
 ('10000000-0000-4000-a000-000000000004','00000000-0000-4000-a000-000000000003'),
 ('10000000-0000-4000-a000-000000000006','00000000-0000-4000-a000-000000000001'),
 ('10000000-0000-4000-a000-000000000006','00000000-0000-4000-a000-000000000002'),
 ('10000000-0000-4000-a000-000000000007','00000000-0000-4000-a000-000000000002'),
 ('10000000-0000-4000-a000-000000000008','00000000-0000-4000-a000-000000000001'),
 ('10000000-0000-4000-a000-000000000009','00000000-0000-4000-a000-000000000001'),
 ('10000000-0000-4000-a000-000000000009','00000000-0000-4000-a000-000000000002'),
 ('10000000-0000-4000-a000-000000000009','00000000-0000-4000-a000-000000000003'),
 ('10000000-0000-4000-a000-000000000012','00000000-0000-4000-a000-000000000003')
ON CONFLICT DO NOTHING;

-- Horários de demonstração: dias úteis dos próximos 30 dias, 9h–17h (horário de Brasília), alguns por profissional.
INSERT INTO public.availability_slots (provider_id, starts_at, duration_min)
SELECT p.id, (d::date + make_interval(hours => h)) AT TIME ZONE 'America/Sao_Paulo', 30
FROM public.providers p
CROSS JOIN generate_series(current_date + 1, current_date + 30, interval '1 day') d
CROSS JOIN generate_series(9, 17) h
WHERE p.is_demo AND extract(isodow FROM d) < 6 AND (h + extract(day FROM d)::int + length(p.name)) % 3 <> 0
ON CONFLICT DO NOTHING;