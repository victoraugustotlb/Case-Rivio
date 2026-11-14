CREATE OR REPLACE FUNCTION public.is_patient_account(_uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT account_type IN ('patient_plan','patient_individual') FROM public.profiles WHERE user_id = _uid), true)
$$;

DROP POLICY IF EXISTS "Conectados leem profissionais" ON public.providers;
CREATE POLICY "Pacientes e o próprio profissional leem" ON public.providers FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_patient_account(auth.uid()));

DROP POLICY IF EXISTS "Conectados leem convênios aceitos" ON public.provider_plans;
CREATE POLICY "Pacientes e o próprio profissional leem convênios" ON public.provider_plans FOR SELECT TO authenticated
USING (public.is_patient_account(auth.uid()) OR EXISTS (SELECT 1 FROM public.providers p WHERE p.id = provider_plans.provider_id AND p.user_id = auth.uid()));

DROP POLICY IF EXISTS "Conectados leem horários" ON public.availability_slots;
CREATE POLICY "Horários livres, próprios ou agendados por mim" ON public.availability_slots FOR SELECT TO authenticated
USING (
  (booked = false AND public.is_patient_account(auth.uid()))
  OR EXISTS (SELECT 1 FROM public.providers p WHERE p.id = availability_slots.provider_id AND p.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.appointments a WHERE a.slot_id = availability_slots.id AND a.patient_id = auth.uid())
);