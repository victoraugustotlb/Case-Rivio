CREATE TABLE public.patient_profiles (
 user_id uuid PRIMARY KEY DEFAULT auth.uid(),
 full_name text NOT NULL DEFAULT '' CHECK (char_length(full_name) <= 150),
 birth_date date,
 height_cm numeric CHECK (height_cm > 0 AND height_cm <= 300),
 weight_kg numeric CHECK (weight_kg > 0 AND weight_kg <= 700),
 medications jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(medications) = 'array'),
 allergies text NOT NULL DEFAULT '' CHECK (char_length(allergies) <= 2000),
 conditions text NOT NULL DEFAULT '' CHECK (char_length(conditions) <= 2000),
 surgeries text NOT NULL DEFAULT '' CHECK (char_length(surgeries) <= 2000),
 family_history text NOT NULL DEFAULT '' CHECK (char_length(family_history) <= 2000),
 smoking text NOT NULL DEFAULT '',
 alcohol text NOT NULL DEFAULT '',
 activity text NOT NULL DEFAULT '',
 questionnaire_completed boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_profiles TO authenticated;
GRANT ALL ON public.patient_profiles TO service_role;
ALTER TABLE public.patient_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads profile" ON public.patient_profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Owner inserts profile" ON public.patient_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner updates profile" ON public.patient_profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner deletes profile" ON public.patient_profiles FOR DELETE TO authenticated USING (auth.uid() = user_id);