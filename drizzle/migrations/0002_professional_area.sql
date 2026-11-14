ALTER TABLE public.access_requests ADD COLUMN request_upload boolean NOT NULL DEFAULT false;
ALTER TABLE public.access_requests ADD COLUMN upload_granted boolean NOT NULL DEFAULT false;
ALTER TABLE public.documents ADD COLUMN uploaded_by uuid;
ALTER TABLE public.documents ADD COLUMN uploaded_by_role text;
ALTER TABLE public.documents ADD COLUMN uploaded_by_name text;
ALTER TABLE public.documents ADD COLUMN status text NOT NULL DEFAULT 'accepted';
ALTER TABLE public.documents ADD COLUMN note text;
CREATE INDEX documents_uploaded_by_idx ON public.documents(uploaded_by);

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  link text,
  ref text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX notifications_dedupe ON public.notifications(user_id, kind, ref);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuário lê os próprios avisos" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Usuário marca os próprios avisos" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());