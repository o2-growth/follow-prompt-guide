
CREATE TABLE public.ai_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  surface text NOT NULL CHECK (surface IN ('okrs','team','financial','rituals','vision')),
  status text NOT NULL DEFAULT 'pending',
  content_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  model text,
  error_message text,
  generated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, surface)
);

ALTER TABLE public.ai_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read ai_suggestions"
  ON public.ai_suggestions FOR SELECT TO authenticated
  USING (public.is_member(tenant_id, auth.uid()));

CREATE POLICY "Block direct write ai_suggestions insert"
  ON public.ai_suggestions FOR INSERT TO authenticated WITH CHECK (false);

CREATE POLICY "Block direct write ai_suggestions update"
  ON public.ai_suggestions FOR UPDATE TO authenticated USING (false) WITH CHECK (false);

CREATE TRIGGER ai_suggestions_touch
  BEFORE UPDATE ON public.ai_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_ai_suggestions_tenant ON public.ai_suggestions(tenant_id);
