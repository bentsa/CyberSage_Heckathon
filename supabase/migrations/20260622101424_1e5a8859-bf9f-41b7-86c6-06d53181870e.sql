
-- =========================================================
-- ROLES
-- =========================================================
CREATE TYPE public.app_role AS ENUM ('admin','auditor','officer','public');

CREATE TABLE public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles self read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "profiles self upsert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles self read" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Auto-create profile and default role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
  ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'officer'::public.app_role)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- SA ID REGISTRY
-- =========================================================
CREATE TABLE public.sa_id_registry (
  id_number text PRIMARY KEY,
  full_name text,
  date_of_birth date,
  gender text,
  citizenship text,
  status text NOT NULL DEFAULT 'clean',
  notes text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sa_id_registry TO authenticated;
GRANT ALL ON public.sa_id_registry TO service_role;
ALTER TABLE public.sa_id_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "id registry read all auth" ON public.sa_id_registry FOR SELECT TO authenticated USING (true);
CREATE POLICY "id registry admin write" ON public.sa_id_registry FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- =========================================================
-- VERIFICATION TABLES
-- =========================================================
CREATE TABLE public.identity_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id_number text NOT NULL,
  claimed_name text,
  algo_valid boolean NOT NULL,
  date_of_birth date,
  gender text,
  citizenship text,
  duplicate_count int NOT NULL DEFAULT 0,
  risk_score int NOT NULL DEFAULT 0,
  outcome text NOT NULL,
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.identity_verifications TO authenticated;
GRANT ALL ON public.identity_verifications TO service_role;
ALTER TABLE public.identity_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "iv self read" ON public.identity_verifications FOR SELECT TO authenticated
  USING (requested_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'auditor'));
CREATE POLICY "iv self insert" ON public.identity_verifications FOR INSERT TO authenticated WITH CHECK (requested_by = auth.uid());

CREATE TABLE public.vendor_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  registration_number text,
  amount numeric,
  cipc_exists boolean NOT NULL DEFAULT false,
  tax_clearance boolean NOT NULL DEFAULT false,
  bank_verified boolean NOT NULL DEFAULT false,
  company_age_days int,
  risk_score int NOT NULL DEFAULT 0,
  outcome text NOT NULL,
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.vendor_verifications TO authenticated;
GRANT ALL ON public.vendor_verifications TO service_role;
ALTER TABLE public.vendor_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vv read" ON public.vendor_verifications FOR SELECT TO authenticated
  USING (requested_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'auditor'));
CREATE POLICY "vv insert" ON public.vendor_verifications FOR INSERT TO authenticated WITH CHECK (requested_by = auth.uid());

CREATE TABLE public.invoice_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_number text NOT NULL,
  po_number text,
  vendor_name text,
  amount numeric NOT NULL,
  risk_score int NOT NULL DEFAULT 0,
  outcome text NOT NULL,
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.invoice_verifications TO authenticated;
GRANT ALL ON public.invoice_verifications TO service_role;
ALTER TABLE public.invoice_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inv read" ON public.invoice_verifications FOR SELECT TO authenticated
  USING (requested_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'auditor'));
CREATE POLICY "inv insert" ON public.invoice_verifications FOR INSERT TO authenticated WITH CHECK (requested_by = auth.uid());

CREATE TABLE public.hire_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  candidate_name text NOT NULL,
  candidate_id_number text,
  position text NOT NULL,
  qualifications text[] NOT NULL DEFAULT '{}',
  nepotism_flag boolean NOT NULL DEFAULT false,
  criminal_flag boolean NOT NULL DEFAULT false,
  risk_score int NOT NULL DEFAULT 0,
  outcome text NOT NULL,
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.hire_verifications TO authenticated;
GRANT ALL ON public.hire_verifications TO service_role;
ALTER TABLE public.hire_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hv read" ON public.hire_verifications FOR SELECT TO authenticated
  USING (requested_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'auditor'));
CREATE POLICY "hv insert" ON public.hire_verifications FOR INSERT TO authenticated WITH CHECK (requested_by = auth.uid());

CREATE TABLE public.tender_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tender_ref text NOT NULL,
  classification text NOT NULL,
  user_clearance text NOT NULL,
  channel text NOT NULL,
  allowed boolean NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.tender_access_log TO authenticated;
GRANT ALL ON public.tender_access_log TO service_role;
ALTER TABLE public.tender_access_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tal read" ON public.tender_access_log FOR SELECT TO authenticated
  USING (requested_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'auditor'));
CREATE POLICY "tal insert" ON public.tender_access_log FOR INSERT TO authenticated WITH CHECK (requested_by = auth.uid());

-- =========================================================
-- CHAT
-- =========================================================
CREATE TABLE public.chat_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New conversation',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_threads TO authenticated;
GRANT ALL ON public.chat_threads TO service_role;
ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ct own" ON public.chat_threads FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cm own" ON public.chat_messages FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX idx_chat_messages_thread ON public.chat_messages(thread_id, created_at);

-- =========================================================
-- AUDIT
-- =========================================================
CREATE TABLE public.integrity_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  outcome text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.integrity_audit_log TO authenticated;
GRANT ALL ON public.integrity_audit_log TO service_role;
ALTER TABLE public.integrity_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit read" ON public.integrity_audit_log FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'auditor'));
CREATE POLICY "audit insert" ON public.integrity_audit_log FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
