-- Tabela para armazenar plano de ação gerado por IA
CREATE TABLE public.ai_action_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending | generating | ready | failed
  model text,
  content_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  generated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_action_plans_tenant ON public.ai_action_plans(tenant_id, created_at DESC);

ALTER TABLE public.ai_action_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read action plans"
  ON public.ai_action_plans FOR SELECT TO authenticated
  USING (public.is_member(tenant_id, auth.uid()));

-- INSERT/UPDATE só pela edge function (service role bypassa RLS); bloqueia escrita direta do client
CREATE POLICY "Block direct write action plans insert"
  ON public.ai_action_plans FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "Block direct write action plans update"
  ON public.ai_action_plans FOR UPDATE TO authenticated
  USING (false) WITH CHECK (false);

CREATE TRIGGER trg_ai_action_plans_touch
  BEFORE UPDATE ON public.ai_action_plans
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();