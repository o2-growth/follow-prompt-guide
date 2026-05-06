
-- =====================
-- ENUMS
-- =====================
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.membership_role AS ENUM ('owner', 'admin', 'member', 'viewer');
CREATE TYPE public.goal_level AS ENUM ('annual', 'quarter', 'month', 'week');
CREATE TYPE public.okr_level AS ENUM ('company', 'area', 'team', 'individual');
CREATE TYPE public.scenario_kind AS ENUM ('optimistic', 'realistic', 'pessimistic');
CREATE TYPE public.ritual_kind AS ENUM ('daily', 'weekly', 'monthly', 'quarter', 'one_on_one');
CREATE TYPE public.maturity_dimension AS ENUM ('vision', 'okrs', 'rituals', 'team', 'financial');

-- =====================
-- USER PROFILES
-- =====================
CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  role_title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles viewable by owner" ON public.user_profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Profiles insert self" ON public.user_profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Profiles update self" ON public.user_profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

-- =====================
-- USER ROLES (global)
-- =====================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "Users see own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- =====================
-- TENANTS
-- =====================
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cnpj TEXT,
  sector TEXT,
  size_band TEXT,
  revenue_band TEXT,
  plan_locked TEXT NOT NULL DEFAULT 'presente_g4',
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- =====================
-- MEMBERSHIPS
-- =====================
CREATE TABLE public.memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role membership_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

-- helper functions to avoid recursive RLS
CREATE OR REPLACE FUNCTION public.is_member(_tenant UUID, _user UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.memberships WHERE tenant_id = _tenant AND user_id = _user);
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_admin(_tenant UUID, _user UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE tenant_id = _tenant AND user_id = _user AND role IN ('owner','admin')
  );
$$;

CREATE POLICY "Members see own memberships" ON public.memberships
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_tenant_admin(tenant_id, auth.uid()));
CREATE POLICY "Tenant admins manage memberships" ON public.memberships
  FOR ALL TO authenticated
  USING (public.is_tenant_admin(tenant_id, auth.uid()))
  WITH CHECK (public.is_tenant_admin(tenant_id, auth.uid()) OR user_id = auth.uid());

-- tenants policies (after helpers exist)
CREATE POLICY "Members read tenant" ON public.tenants
  FOR SELECT TO authenticated USING (public.is_member(id, auth.uid()));
CREATE POLICY "Authenticated create tenant" ON public.tenants
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Tenant admins update" ON public.tenants
  FOR UPDATE TO authenticated USING (public.is_tenant_admin(id, auth.uid()));
CREATE POLICY "Tenant owners delete" ON public.tenants
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.memberships WHERE tenant_id = id AND user_id = auth.uid() AND role = 'owner')
  );

-- =====================
-- INVITATIONS
-- =====================
CREATE TABLE public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role membership_role NOT NULL DEFAULT 'member',
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24),'hex'),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant admins manage invites" ON public.invitations
  FOR ALL TO authenticated
  USING (public.is_tenant_admin(tenant_id, auth.uid()))
  WITH CHECK (public.is_tenant_admin(tenant_id, auth.uid()));

-- =====================
-- VISION PLANS & GOALS
-- =====================
CREATE TABLE public.vision_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  year_horizon INT NOT NULL CHECK (year_horizon IN (1,3,5)),
  north_star TEXT,
  mission TEXT,
  values_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, year_horizon)
);
ALTER TABLE public.vision_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage vision" ON public.vision_plans
  FOR ALL TO authenticated
  USING (public.is_member(tenant_id, auth.uid()))
  WITH CHECK (public.is_member(tenant_id, auth.uid()));

CREATE TABLE public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  vision_plan_id UUID REFERENCES public.vision_plans(id) ON DELETE CASCADE,
  parent_goal_id UUID REFERENCES public.goals(id) ON DELETE CASCADE,
  level goal_level NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  target_value NUMERIC,
  target_unit TEXT,
  target_date DATE,
  status TEXT NOT NULL DEFAULT 'on_track',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage goals" ON public.goals
  FOR ALL TO authenticated
  USING (public.is_member(tenant_id, auth.uid()))
  WITH CHECK (public.is_member(tenant_id, auth.uid()));

-- =====================
-- OKRs
-- =====================
CREATE TABLE public.okrs_objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  level okr_level NOT NULL DEFAULT 'company',
  title TEXT NOT NULL,
  description TEXT,
  owner_id UUID REFERENCES auth.users(id),
  parent_goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL,
  quarter TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.okrs_objectives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage objectives" ON public.okrs_objectives
  FOR ALL TO authenticated
  USING (public.is_member(tenant_id, auth.uid()))
  WITH CHECK (public.is_member(tenant_id, auth.uid()));

CREATE TABLE public.key_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  objective_id UUID NOT NULL REFERENCES public.okrs_objectives(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  metric_type TEXT,
  baseline NUMERIC,
  target NUMERIC,
  current NUMERIC,
  unit TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.key_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage KRs" ON public.key_results
  FOR ALL TO authenticated
  USING (public.is_member(tenant_id, auth.uid()))
  WITH CHECK (public.is_member(tenant_id, auth.uid()));

CREATE TABLE public.okr_check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  key_result_id UUID NOT NULL REFERENCES public.key_results(id) ON DELETE CASCADE,
  week DATE NOT NULL,
  value NUMERIC,
  confidence INT CHECK (confidence BETWEEN 1 AND 10),
  note TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.okr_check_ins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage check-ins" ON public.okr_check_ins
  FOR ALL TO authenticated
  USING (public.is_member(tenant_id, auth.uid()))
  WITH CHECK (public.is_member(tenant_id, auth.uid()));

-- =====================
-- FINANCIAL
-- =====================
CREATE TABLE public.financial_projections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  scenario scenario_kind NOT NULL,
  horizon_years INT NOT NULL CHECK (horizon_years IN (1,3,5)),
  inputs_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, scenario, horizon_years)
);
ALTER TABLE public.financial_projections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage projections" ON public.financial_projections
  FOR ALL TO authenticated
  USING (public.is_member(tenant_id, auth.uid()))
  WITH CHECK (public.is_member(tenant_id, auth.uid()));

CREATE TABLE public.dre_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  projection_id UUID NOT NULL REFERENCES public.financial_projections(id) ON DELETE CASCADE,
  year INT NOT NULL,
  category TEXT NOT NULL,
  label TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  formula_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.dre_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage DRE items" ON public.dre_line_items
  FOR ALL TO authenticated
  USING (public.is_member(tenant_id, auth.uid()))
  WITH CHECK (public.is_member(tenant_id, auth.uid()));

CREATE TABLE public.sales_funnels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  year INT NOT NULL,
  lead_volume NUMERIC,
  conversion_rate NUMERIC,
  ticket_avg NUMERIC,
  expected_revenue NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sales_funnels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage funnels" ON public.sales_funnels
  FOR ALL TO authenticated
  USING (public.is_member(tenant_id, auth.uid()))
  WITH CHECK (public.is_member(tenant_id, auth.uid()));

-- =====================
-- TEAM / ORG
-- =====================
CREATE TABLE public.org_charts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  area TEXT NOT NULL,
  structure_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.org_charts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage org" ON public.org_charts
  FOR ALL TO authenticated
  USING (public.is_member(tenant_id, auth.uid()))
  WITH CHECK (public.is_member(tenant_id, auth.uid()));

-- Global catalog: roles & frameworks
CREATE TABLE public.role_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area TEXT NOT NULL,
  role_name TEXT NOT NULL,
  description TEXT,
  framework_key TEXT,
  framework_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.role_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated reads catalog" ON public.role_templates
  FOR SELECT TO authenticated USING (true);

CREATE TABLE public.framework_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  framework_key TEXT NOT NULL,
  applied_to_team TEXT,
  content_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.framework_instances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage frameworks" ON public.framework_instances
  FOR ALL TO authenticated
  USING (public.is_member(tenant_id, auth.uid()))
  WITH CHECK (public.is_member(tenant_id, auth.uid()));

-- =====================
-- RITUALS
-- =====================
CREATE TABLE public.rituals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  kind ritual_kind NOT NULL,
  template_id TEXT,
  name TEXT NOT NULL,
  cadence_cron TEXT,
  owner_id UUID REFERENCES auth.users(id),
  agenda_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.rituals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage rituals" ON public.rituals
  FOR ALL TO authenticated
  USING (public.is_member(tenant_id, auth.uid()))
  WITH CHECK (public.is_member(tenant_id, auth.uid()));

CREATE TABLE public.ritual_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ritual_id UUID NOT NULL REFERENCES public.rituals(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned',
  attendees_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  minutes_md TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ritual_instances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage ritual instances" ON public.ritual_instances
  FOR ALL TO authenticated
  USING (public.is_member(tenant_id, auth.uid()))
  WITH CHECK (public.is_member(tenant_id, auth.uid()));

-- =====================
-- MATURITY
-- =====================
CREATE TABLE public.maturity_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  dimension maturity_dimension NOT NULL,
  score INT NOT NULL CHECK (score BETWEEN 0 AND 100),
  answers_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  taken_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.maturity_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage maturity" ON public.maturity_assessments
  FOR ALL TO authenticated
  USING (public.is_member(tenant_id, auth.uid()))
  WITH CHECK (public.is_member(tenant_id, auth.uid()));

CREATE TABLE public.maturity_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  assessment_id UUID REFERENCES public.maturity_assessments(id) ON DELETE CASCADE,
  dimension maturity_dimension NOT NULL,
  recommendation_md TEXT NOT NULL,
  priority INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.maturity_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage recommendations" ON public.maturity_recommendations
  FOR ALL TO authenticated
  USING (public.is_member(tenant_id, auth.uid()))
  WITH CHECK (public.is_member(tenant_id, auth.uid()));

-- =====================
-- AUDIT LOG
-- =====================
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  payload_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read audit" ON public.audit_log
  FOR SELECT TO authenticated USING (public.is_member(tenant_id, auth.uid()));
CREATE POLICY "Members write audit" ON public.audit_log
  FOR INSERT TO authenticated WITH CHECK (public.is_member(tenant_id, auth.uid()));

-- =====================
-- TRIGGERS: updated_at
-- =====================
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'user_profiles','tenants','vision_plans','goals','okrs_objectives',
    'key_results','financial_projections','sales_funnels','org_charts',
    'framework_instances','rituals'
  ]) LOOP
    EXECUTE format('CREATE TRIGGER trg_%s_touch BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();', t, t);
  END LOOP;
END $$;

-- =====================
-- AUTO PROFILE + TENANT ON SIGNUP
-- =====================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_tenant UUID;
BEGIN
  INSERT INTO public.user_profiles (id, full_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)));

  INSERT INTO public.tenants (name, created_by)
    VALUES (COALESCE(NEW.raw_user_meta_data->>'company_name', 'Meu Workspace'), NEW.id)
    RETURNING id INTO new_tenant;

  INSERT INTO public.memberships (tenant_id, user_id, role)
    VALUES (new_tenant, NEW.id, 'owner');

  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================
-- SEED: role_templates catalog
-- =====================
INSERT INTO public.role_templates (area, role_name, description, framework_key, framework_summary) VALUES
('commercial', 'SDR', 'Prospecção outbound, qualificação inicial', 'SPIN', 'Situation, Problem, Implication, Need-payoff'),
('commercial', 'Closer / Account Executive', 'Condução de pipeline e fechamento', 'MEDDIC', 'Metrics, Economic buyer, Decision criteria, Decision process, Identify pain, Champion'),
('commercial', 'Head Comercial', 'Estratégia, forecast, gestão de time', 'RACI', 'Responsible, Accountable, Consulted, Informed'),
('ops', 'Head de Operações', 'Processos, eficiência operacional', 'RACI', 'Matriz de responsabilidades por processo'),
('finance', 'Controller', 'DRE, orçamento, indicadores', 'OKR Financeiro', 'Metas trimestrais financeiras com KRs claros'),
('finance', 'CFO / CFO-as-a-Service', 'Estratégia financeira, captação, M&A', 'Visão por horizonte', 'Planejamento 5/3/1 ano com cenários'),
('product', 'Head de Produto', 'Roadmap, descoberta, métricas', 'OKR Produto', 'Foco em outcome, não output');
