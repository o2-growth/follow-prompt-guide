-- =====================================================================
-- 20260506_dara_critical_fixes.sql
-- Owner: Dara (Data Engineer / Database Architect)
-- Escopo: Conserta BUG-001 (RLS 403 memberships), C6 (user_roles),
--         I2 (maturity RPCs), I7 (catalogos globais), I10 (role_templates),
--         K6 (recommendations populadas), K7 (audit log RPC), goals cascade,
--         financial persistence init.
--
-- Idempotente: usa IF NOT EXISTS, OR REPLACE, ON CONFLICT DO NOTHING,
--              DROP POLICY IF EXISTS antes de re-criar.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 0) ROOT CAUSE BUG-001
-- ---------------------------------------------------------------------
-- A migration anterior 20260506034928 revogou EXECUTE em
-- is_member/is_tenant_admin/has_role/handle_new_user de authenticated.
-- Como as policies de RLS sao avaliadas no contexto do caller, sem
-- EXECUTE essas funcoes lancam permission denied no SELECT/INSERT que
-- usa is_member(...) ou is_tenant_admin(...) na expressao USING/WITH CHECK
-- => Postgres devolve 42501, PostgREST reporta como 403.
-- Adicionalmente o trigger handle_new_user precisa ser invocavel pelo
-- role que esta inserindo em auth.users (supabase_auth_admin); revogar de
-- authenticated nao quebra o trigger, mas re-grant explicito para
-- supabase_auth_admin elimina ambiguidade.
-- Fix: GRANT EXECUTE seletivo + reescreve policies pra nao depender de
-- helper recursivo no caso "ver minhas proprias memberships".
-- ---------------------------------------------------------------------

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_tenant_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;

-- Reescreve helpers garantindo SECURITY DEFINER + search_path travado.
CREATE OR REPLACE FUNCTION public.is_member(_tenant uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE tenant_id = _tenant AND user_id = _user
  );
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_admin(_tenant uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE tenant_id = _tenant AND user_id = _user AND role IN ('owner','admin')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_tenant_admin(uuid, uuid) TO authenticated;

-- Helper de conveniencia (overload de 1 arg) que ja injeta auth.uid().
-- O AGENT_PERSONA pede "is_member(p_tenant uuid)"; criamos como wrapper.
CREATE OR REPLACE FUNCTION public.is_member(_tenant uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_member(_tenant, auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_admin(_tenant uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_tenant_admin(_tenant, auth.uid());
$$;

GRANT EXECUTE ON FUNCTION public.is_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_tenant_admin(uuid) TO authenticated;

-- ---------------------------------------------------------------------
-- 1) MEMBERSHIPS POLICIES (BUG-001 fix definitivo)
-- ---------------------------------------------------------------------
-- Policy SELECT antiga: "user_id = auth.uid() OR is_tenant_admin(...)"
-- O OR ja deveria deixar usuario ver as proprias memberships, mas se
-- is_tenant_admin nao tem EXECUTE, o predicate inteiro falha mesmo na
-- primeira condicao em alguns planos (lazy eval nao garantido em RLS).
-- Reescreve em duas policies separadas pra eliminar dependencia.

DROP POLICY IF EXISTS "Members see own memberships" ON public.memberships;
DROP POLICY IF EXISTS "Tenant admins manage memberships" ON public.memberships;
DROP POLICY IF EXISTS "Users see own memberships" ON public.memberships;
DROP POLICY IF EXISTS "Tenant admins see all memberships" ON public.memberships;
DROP POLICY IF EXISTS "User inserts own membership" ON public.memberships;
DROP POLICY IF EXISTS "Tenant admins manage other memberships" ON public.memberships;

-- SELECT: o usuario SEMPRE ve as proprias memberships, sem chamar helper
CREATE POLICY "Users see own memberships" ON public.memberships
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- SELECT: tenant admin ve todas as memberships do tenant dele
CREATE POLICY "Tenant admins see all memberships" ON public.memberships
  FOR SELECT TO authenticated
  USING (public.is_tenant_admin(tenant_id, auth.uid()));

-- INSERT: usuario insere a propria membership (caso especial: trigger
-- usa SECURITY DEFINER e ignora RLS, mas garantimos que client tambem
-- pode caso queira aceitar invite).
CREATE POLICY "User inserts own membership" ON public.memberships
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_tenant_admin(tenant_id, auth.uid()));

-- UPDATE/DELETE: somente tenant admin
CREATE POLICY "Tenant admins manage other memberships" ON public.memberships
  FOR UPDATE TO authenticated
  USING (public.is_tenant_admin(tenant_id, auth.uid()))
  WITH CHECK (public.is_tenant_admin(tenant_id, auth.uid()));

CREATE POLICY "Tenant admins delete memberships" ON public.memberships
  FOR DELETE TO authenticated
  USING (public.is_tenant_admin(tenant_id, auth.uid()));

-- ---------------------------------------------------------------------
-- 2) handle_new_user com guarda de excecao + DEFAULT em tenants.name
-- ---------------------------------------------------------------------

ALTER TABLE public.tenants
  ALTER COLUMN name SET DEFAULT 'Meu Workspace';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_tenant uuid;
  v_full_name text;
  v_company_name text;
BEGIN
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );
  v_company_name := COALESCE(
    NEW.raw_user_meta_data->>'company_name',
    'Meu Workspace'
  );

  BEGIN
    INSERT INTO public.user_profiles (id, full_name)
      VALUES (NEW.id, v_full_name)
      ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.tenants (name, created_by)
      VALUES (v_company_name, NEW.id)
      RETURNING id INTO new_tenant;

    INSERT INTO public.memberships (tenant_id, user_id, role)
      VALUES (new_tenant, NEW.id, 'owner')
      ON CONFLICT (tenant_id, user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- nao silencia: registra no postgres log com contexto pra debug
    RAISE WARNING 'handle_new_user falhou para user %: % - %',
      NEW.id, SQLSTATE, SQLERRM;
    -- Retorna NEW mesmo em erro: nao queremos bloquear o signup do auth
    -- por falha em side-effect; UI pode reconstruir tenant via RPC fallback.
  END;

  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;

-- Garante que trigger esta ligado em auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------
-- 3) RPC ensure_tenant_for_user (fallback caso trigger tenha falhado)
-- ---------------------------------------------------------------------
-- Se um usuario antigo chegou ao app sem membership por causa do bug
-- anterior, este RPC e idempotente e cria tenant + owner membership.
CREATE OR REPLACE FUNCTION public.ensure_tenant_for_user()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_tenant uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'auth.uid() vazio';
  END IF;

  SELECT tenant_id INTO v_tenant
    FROM public.memberships
    WHERE user_id = v_user
    ORDER BY joined_at ASC
    LIMIT 1;

  IF v_tenant IS NOT NULL THEN
    RETURN v_tenant;
  END IF;

  INSERT INTO public.tenants (name, created_by)
    VALUES ('Meu Workspace', v_user)
    RETURNING id INTO v_tenant;

  INSERT INTO public.memberships (tenant_id, user_id, role)
    VALUES (v_tenant, v_user, 'owner')
    ON CONFLICT (tenant_id, user_id) DO NOTHING;

  INSERT INTO public.user_profiles (id)
    VALUES (v_user)
    ON CONFLICT (id) DO NOTHING;

  RETURN v_tenant;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_tenant_for_user() TO authenticated;

-- ---------------------------------------------------------------------
-- 4) C6: user_roles policies + assign_app_role RPC
-- ---------------------------------------------------------------------
-- Hoje user_roles tem RLS ON com so policy de SELECT. INSERT/UPDATE/DELETE
-- do client direto sao implicitamente negados. A unica forma legitima e
-- via RPC SECURITY DEFINER.

DROP POLICY IF EXISTS "Users see own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Block direct write to user_roles" ON public.user_roles;

CREATE POLICY "Users see own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Policies "no-op" explicitas que NEGAM escrita direta (defesa em
-- profundidade: deixa a intencao explicita pro futuro auditor)
CREATE POLICY "Block direct write to user_roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (false)
  WITH CHECK (false);

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

CREATE OR REPLACE FUNCTION public.assign_app_role(
  p_user_id uuid,
  p_role public.app_role
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_admin_count integer;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Nao autenticado';
  END IF;

  SELECT count(*) INTO v_admin_count FROM public.user_roles WHERE role = 'admin';

  -- Bootstrap: se NAO existe nenhum admin, qualquer authenticated pode
  -- promover a si mesmo como primeiro admin (uso unico).
  IF v_admin_count = 0 THEN
    IF p_user_id <> v_caller THEN
      RAISE EXCEPTION 'Bootstrap inicial: voce so pode promover a si mesmo';
    END IF;
  ELSE
    -- A partir do segundo admin: somente admin existente promove.
    IF NOT public.has_role(v_caller, 'admin') THEN
      RAISE EXCEPTION 'Apenas admin existente pode atribuir roles globais';
    END IF;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
    VALUES (p_user_id, p_role)
    ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_app_role(uuid, public.app_role) TO authenticated;

CREATE OR REPLACE FUNCTION public.revoke_app_role(
  p_user_id uuid,
  p_role public.app_role
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas admin pode revogar roles';
  END IF;
  DELETE FROM public.user_roles WHERE user_id = p_user_id AND role = p_role;
END;
$$;

GRANT EXECUTE ON FUNCTION public.revoke_app_role(uuid, public.app_role) TO authenticated;

-- ---------------------------------------------------------------------
-- 5) I7: ritual_templates global catalog
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ritual_templates (
  id text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('daily','weekly','monthly','quarter','one_on_one')),
  name text NOT NULL,
  cadence_cron text,
  duration_minutes int,
  agenda_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  description text,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ritual_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read ritual templates" ON public.ritual_templates;
CREATE POLICY "Read ritual templates" ON public.ritual_templates
  FOR SELECT TO authenticated USING (true);

-- Seeds (idempotentes)
INSERT INTO public.ritual_templates (id, kind, name, cadence_cron, duration_minutes, agenda_json, description, display_order) VALUES
('daily-standup', 'daily', 'Daily Standup', '0 9 * * 1-5', 15,
  '[
    {"item":"Top 3 prioridades de hoje","minutes":5},
    {"item":"Bloqueios","minutes":5},
    {"item":"Quem precisa de ajuda?","minutes":5}
  ]'::jsonb,
  'Sincronizacao diaria do time. Foco em desbloquear, nao em status.', 10),
('weekly-review', 'weekly', 'Weekly Review (L10/EOS)', '0 14 * * 1', 60,
  '[
    {"item":"Numbers (KPIs/KRs)","minutes":10},
    {"item":"Headlines","minutes":5},
    {"item":"To-do review","minutes":10},
    {"item":"IDS - identify, discuss, solve issues","minutes":30},
    {"item":"Recap + cascading messages","minutes":5}
  ]'::jsonb,
  'Reuniao semanal de comando. Revisa numeros, decisoes e issues.', 20),
('one-on-one-biweekly', 'one_on_one', '1:1 quinzenal', '0 16 * * 3/2', 30,
  '[
    {"item":"Como voce esta? (carreira/pessoal)","minutes":10},
    {"item":"Wins e bloqueios da quinzena","minutes":10},
    {"item":"Feedback bi-direcional","minutes":5},
    {"item":"Combinados pra proxima quinzena","minutes":5}
  ]'::jsonb,
  '1:1 lider-liderado. Pauta do liderado tem prioridade.', 30),
('monthly-business-review', 'monthly', 'Monthly Business Review', '0 10 1 * *', 90,
  '[
    {"item":"OKRs do trimestre - progresso","minutes":20},
    {"item":"Financeiro - DRE realizado vs plano","minutes":20},
    {"item":"Pipeline comercial","minutes":15},
    {"item":"People - headcount, turnover, vagas","minutes":15},
    {"item":"Riscos top-3 e acoes","minutes":15},
    {"item":"Cascateamento pro time","minutes":5}
  ]'::jsonb,
  'Revisao mensal de negocio. Lideranca executiva.', 40),
('quarterly-planning', 'quarter', 'Quarterly Planning (QBR)', '0 9 1 1,4,7,10 *', 240,
  '[
    {"item":"Retrospectiva do Q anterior - o que aprendemos","minutes":30},
    {"item":"OKRs do proximo Q - draft","minutes":60},
    {"item":"Alocacao de recursos + headcount","minutes":45},
    {"item":"Riscos e mitigacoes","minutes":30},
    {"item":"Comunicacao para o time","minutes":30},
    {"item":"Decisoes arquivadas + commits","minutes":45}
  ]'::jsonb,
  'Planejamento trimestral com lideranca. 4h em offsite preferencialmente.', 50)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 6) I7: framework_library global catalog
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.framework_library (
  key text PRIMARY KEY,
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('sales','ops','general','strategy','finance','people')),
  description_md text,
  template_md text,
  example_md text,
  when_to_apply text,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.framework_library ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read framework library" ON public.framework_library;
CREATE POLICY "Read framework library" ON public.framework_library
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.framework_library (key, name, category, description_md, template_md, example_md, when_to_apply, display_order) VALUES
('SPIN', 'SPIN Selling', 'sales',
  '**SPIN** = Situation, Problem, Implication, Need-payoff. Tecnica de Neil Rackham para venda consultiva B2B.',
  '- **Situation:** Como esta hoje seu processo de X?\n- **Problem:** Qual a maior dor disso?\n- **Implication:** Se nao resolver, qual o custo em 12 meses?\n- **Need-payoff:** Se resolvesse, o que destravava?',
  'SDR ligando pra prospect:\n- S: "Voces usam planilhas pra DRE?"\n- P: "Quanto tempo o time perde fechando o mes?"\n- I: "Se atrasa o forecast, atrasa decisao de hire?"\n- N: "Se entregassemos DRE em 3 dias, quanto mais cedo voce contrata?"',
  'Venda consultiva ticket alto, ciclo > 30 dias. SDR/AE.', 10),
('MEDDIC', 'MEDDIC', 'sales',
  '**MEDDIC** = Metrics, Economic buyer, Decision criteria, Decision process, Identify pain, Champion. Qualificacao enterprise.',
  '- **Metrics:** que numero o cliente quer mover?\n- **Economic Buyer:** quem assina o cheque?\n- **Decision Criteria:** o que torna a solucao "boa"?\n- **Decision Process:** quem aprova, quanto tempo, quais etapas?\n- **Identify Pain:** dor real, mensuravel?\n- **Champion:** quem internamente vende por voce?',
  'Negociacao SaaS R$200k/ano:\n- M: reduzir CAC de R$8k para R$5k\n- EB: CFO, nao o CMO\n- DC: ROI < 12 meses, integracao Salesforce\n- DP: piloto 30 dias > comite > board\n- IP: CAC subindo 18% YoY\n- C: VP Marketing assinou caso de uso interno',
  'Closer com pipeline enterprise. Aplicar a cada deal > R$50k.', 20),
('RACI', 'RACI Matrix', 'ops',
  '**RACI** = Responsible, Accountable, Consulted, Informed. Matriz de responsabilidades por atividade.',
  '| Atividade | Pessoa A | Pessoa B | Pessoa C |\n|---|---|---|---|\n| Tarefa X | R | A | C |\n| Tarefa Y | A | R | I |',
  'Processo de fechamento mensal:\n- DRE: R=Controller, A=CFO, C=CEO, I=Board\n- Cobranca: R=Financeiro Jr, A=Controller, C=Comercial, I=CFO',
  'Sempre que existe ambiguidade de "quem faz/quem aprova". Operacao com 5+ pessoas.', 30),
('OKR', 'OKR (Objectives & Key Results)', 'strategy',
  '**OKR** popularizado pelo John Doerr/Google. Objective qualitativo + 3-5 KRs mensuraveis.',
  '**Objective:** [aspiracional, qualitativo, claro]\n- **KR1:** [numero, baseline -> target, deadline]\n- **KR2:** [...]\n- **KR3:** [...]',
  '**Objective:** Tornar O2 a referencia de FP&A em SaaS no Brasil\n- KR1: 50 clientes pagantes ativos (de 12 atual) ate Q4\n- KR2: NPS >= 60 (de 42 atual)\n- KR3: 3 estudos de caso publicados',
  'Trimestral. Empresa, area e individual. Foco em outcome.', 40),
('BANT', 'BANT', 'sales',
  '**BANT** = Budget, Authority, Need, Timing. Qualificacao classica IBM/HubSpot.',
  '- **Budget:** existe orcamento alocado?\n- **Authority:** quem assina?\n- **Need:** dor confirmada?\n- **Timing:** quando precisa estar rodando?',
  'Lead inbound:\n- B: orcado R$50k/ano\n- A: Diretor de RH (autonomia ate R$80k)\n- N: turnover 28% no time\n- T: precisa contratar ate 2 meses',
  'Inbound qualification. Pre-discovery. Nao serve sozinho pra enterprise.', 50),
('Eisenhower', 'Matriz de Eisenhower', 'ops',
  '**Eisenhower Matrix** = Urgente x Importante. Priorizacao pessoal e de time.',
  '| | Urgente | Nao urgente |\n|---|---|---|\n| **Importante** | DO | PLAN |\n| **Nao importante** | DELEGATE | DELETE |',
  'Backlog do CEO numa segunda 9h:\n- DO: aprovar contratacao critica (urg+imp)\n- PLAN: planejar quarterly strategy session (imp, nao urg)\n- DELEGATE: responder vendor X (urg, nao imp)\n- DELETE: redes sociais sem ROI (nem urg nem imp)',
  'Qualquer pessoa sobrecarregada. 1x por semana. Aplicar com timer.', 60)
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------
-- 7) I10: role_templates schema upgrade
-- ---------------------------------------------------------------------

ALTER TABLE public.role_templates
  ADD COLUMN IF NOT EXISTS seniority text
    CHECK (seniority IN ('junior','pleno','senior','head','c-level')),
  ADD COLUMN IF NOT EXISTS recommended_headcount_by_revenue jsonb
    NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS framework_keys text[]
    NOT NULL DEFAULT ARRAY[]::text[];

-- Atualiza seeds existentes (com base nos role_name ja inseridos)
UPDATE public.role_templates
   SET seniority = 'pleno',
       framework_keys = ARRAY['SPIN','BANT'],
       recommended_headcount_by_revenue =
         '[{"revenue_band":"<5M","count":1},{"revenue_band":"5-20M","count":2},{"revenue_band":">20M","count":4}]'::jsonb
 WHERE role_name = 'SDR' AND (seniority IS NULL);

UPDATE public.role_templates
   SET seniority = 'senior',
       framework_keys = ARRAY['MEDDIC','SPIN'],
       recommended_headcount_by_revenue =
         '[{"revenue_band":"<5M","count":1},{"revenue_band":"5-20M","count":3},{"revenue_band":">20M","count":6}]'::jsonb
 WHERE role_name = 'Closer / Account Executive' AND (seniority IS NULL);

UPDATE public.role_templates
   SET seniority = 'head',
       framework_keys = ARRAY['MEDDIC','RACI','OKR'],
       recommended_headcount_by_revenue =
         '[{"revenue_band":"<5M","count":1},{"revenue_band":"5-20M","count":1},{"revenue_band":">20M","count":1}]'::jsonb
 WHERE role_name = 'Head Comercial' AND (seniority IS NULL);

UPDATE public.role_templates
   SET seniority = 'head',
       framework_keys = ARRAY['RACI','Eisenhower','OKR'],
       recommended_headcount_by_revenue =
         '[{"revenue_band":"<5M","count":1},{"revenue_band":"5-20M","count":1},{"revenue_band":">20M","count":1}]'::jsonb
 WHERE role_name = 'Head de Operações' AND (seniority IS NULL);

UPDATE public.role_templates
   SET seniority = 'pleno',
       framework_keys = ARRAY['OKR','RACI'],
       recommended_headcount_by_revenue =
         '[{"revenue_band":"<5M","count":1},{"revenue_band":"5-20M","count":1},{"revenue_band":">20M","count":2}]'::jsonb
 WHERE role_name = 'Controller' AND (seniority IS NULL);

UPDATE public.role_templates
   SET seniority = 'c-level',
       framework_keys = ARRAY['OKR','MEDDIC','RACI'],
       recommended_headcount_by_revenue =
         '[{"revenue_band":"<5M","count":0},{"revenue_band":"5-20M","count":1},{"revenue_band":">20M","count":1}]'::jsonb
 WHERE role_name = 'CFO / CFO-as-a-Service' AND (seniority IS NULL);

UPDATE public.role_templates
   SET seniority = 'head',
       framework_keys = ARRAY['OKR','RACI'],
       recommended_headcount_by_revenue =
         '[{"revenue_band":"<5M","count":1},{"revenue_band":"5-20M","count":1},{"revenue_band":">20M","count":1}]'::jsonb
 WHERE role_name = 'Head de Produto' AND (seniority IS NULL);

-- ---------------------------------------------------------------------
-- 8) I2: maturity assessment RPCs
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.start_assessment(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_questions jsonb;
BEGIN
  IF NOT public.is_member(p_tenant_id, auth.uid()) THEN
    RAISE EXCEPTION 'Sem acesso ao tenant %', p_tenant_id;
  END IF;

  -- 15 perguntas (3 por dimensao). Front pode ler isto e renderizar.
  v_questions := '[
    {"dimension":"vision","key":"v1","prompt":"Existe uma visao de 5 anos compartilhada com o time?","scale":[0,33,66,100]},
    {"dimension":"vision","key":"v2","prompt":"As metas anuais estao explicitamente conectadas a essa visao?","scale":[0,33,66,100]},
    {"dimension":"vision","key":"v3","prompt":"Liderancas conseguem articular a visao em 30 segundos?","scale":[0,33,66,100]},

    {"dimension":"okrs","key":"o1","prompt":"Existem OKRs trimestrais formalizados?","scale":[0,33,66,100]},
    {"dimension":"okrs","key":"o2","prompt":"OKRs tem KRs mensuraveis (numero/data)?","scale":[0,33,66,100]},
    {"dimension":"okrs","key":"o3","prompt":"Existe check-in semanal de progresso dos KRs?","scale":[0,33,66,100]},

    {"dimension":"rituals","key":"r1","prompt":"O time roda daily/weekly de forma consistente?","scale":[0,33,66,100]},
    {"dimension":"rituals","key":"r2","prompt":"Existem 1:1s entre lider e liderados, agendados?","scale":[0,33,66,100]},
    {"dimension":"rituals","key":"r3","prompt":"Existe revisao mensal de negocio com numeros?","scale":[0,33,66,100]},

    {"dimension":"team","key":"t1","prompt":"Existe organograma claro com responsabilidades?","scale":[0,33,66,100]},
    {"dimension":"team","key":"t2","prompt":"Cada papel tem framework de excelencia documentado?","scale":[0,33,66,100]},
    {"dimension":"team","key":"t3","prompt":"Existe plano de carreira explicito por papel?","scale":[0,33,66,100]},

    {"dimension":"financial","key":"f1","prompt":"DRE mensal e fechado em ate 5 dias uteis?","scale":[0,33,66,100]},
    {"dimension":"financial","key":"f2","prompt":"Existe orcamento anual aprovado?","scale":[0,33,66,100]},
    {"dimension":"financial","key":"f3","prompt":"Existe projecao de cenarios (otimista/realista/pessimista)?","scale":[0,33,66,100]}
  ]'::jsonb;

  RETURN jsonb_build_object(
    'tenant_id', p_tenant_id,
    'questions', v_questions,
    'dimensions', jsonb_build_array('vision','okrs','rituals','team','financial')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_assessment(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.compute_maturity_score(
  p_tenant_id uuid,
  p_answers jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dim text;
  v_score int;
  v_dim_record record;
  v_assessment_id uuid;
  v_results jsonb := '[]'::jsonb;
  v_dimensions text[] := ARRAY['vision','okrs','rituals','team','financial'];
BEGIN
  IF NOT public.is_member(p_tenant_id, auth.uid()) THEN
    RAISE EXCEPTION 'Sem acesso ao tenant %', p_tenant_id;
  END IF;

  IF jsonb_typeof(p_answers) <> 'object' THEN
    RAISE EXCEPTION 'p_answers deve ser objeto JSON {dimensao: [valores]}';
  END IF;

  FOREACH v_dim IN ARRAY v_dimensions LOOP
    -- Calcula media dos valores numericos do array daquela dimensao
    SELECT COALESCE(round(avg((value)::numeric))::int, 0) INTO v_score
      FROM jsonb_array_elements_text(COALESCE(p_answers->v_dim, '[]'::jsonb)) AS value
      WHERE value ~ '^[0-9]+(\.[0-9]+)?$';

    v_score := LEAST(100, GREATEST(0, v_score));

    INSERT INTO public.maturity_assessments
      (tenant_id, dimension, score, answers_json)
    VALUES
      (p_tenant_id, v_dim::public.maturity_dimension, v_score,
       jsonb_build_object('values', COALESCE(p_answers->v_dim, '[]'::jsonb)))
    RETURNING id INTO v_assessment_id;

    -- Recomendacoes baseadas em faixa de score (K6: popula tabela)
    IF v_score < 40 THEN
      INSERT INTO public.maturity_recommendations
        (tenant_id, assessment_id, dimension, recommendation_md, priority)
      VALUES
        (p_tenant_id, v_assessment_id, v_dim::public.maturity_dimension,
         '**' || v_dim || ' (' || v_score || '/100):** Estagio inicial. Recomendamos comecar pelos rituais basicos e estruturar OKRs trimestrais. Score abaixo de 40 indica risco de execucao.',
         3);
    ELSIF v_score < 70 THEN
      INSERT INTO public.maturity_recommendations
        (tenant_id, assessment_id, dimension, recommendation_md, priority)
      VALUES
        (p_tenant_id, v_assessment_id, v_dim::public.maturity_dimension,
         '**' || v_dim || ' (' || v_score || '/100):** Em desenvolvimento. Foque em consistencia de check-ins e cascateamento de objetivos.',
         2);
    ELSE
      INSERT INTO public.maturity_recommendations
        (tenant_id, assessment_id, dimension, recommendation_md, priority)
      VALUES
        (p_tenant_id, v_assessment_id, v_dim::public.maturity_dimension,
         '**' || v_dim || ' (' || v_score || '/100):** Maturo. Mantenha o ritual e busque otimizacao incremental + benchmarks externos.',
         1);
    END IF;

    v_results := v_results || jsonb_build_object('dimension', v_dim, 'score', v_score, 'assessment_id', v_assessment_id);
  END LOOP;

  RETURN jsonb_build_object(
    'tenant_id', p_tenant_id,
    'results', v_results,
    'overall',
      (SELECT round(avg(score))::int FROM jsonb_array_elements(v_results) e
        WHERE (e->>'score') ~ '^[0-9]+$')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.compute_maturity_score(uuid, jsonb) TO authenticated;

-- ---------------------------------------------------------------------
-- 9) Goals cascade RPC: decompose_vision (suporte a I6 e CEO #3)
-- ---------------------------------------------------------------------
-- Schema goals/vision_plans ja existe. Aqui criamos so o RPC de leitura
-- em arvore (vision -> annual goals -> quarter goals -> month goals).

CREATE OR REPLACE FUNCTION public.decompose_vision(p_vision_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_tree jsonb;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.vision_plans WHERE id = p_vision_id;
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Vision plan % nao encontrado', p_vision_id;
  END IF;
  IF NOT public.is_member(v_tenant, auth.uid()) THEN
    RAISE EXCEPTION 'Sem acesso ao tenant';
  END IF;

  WITH RECURSIVE goal_tree AS (
    SELECT g.id, g.parent_goal_id, g.level::text AS level, g.title,
           g.target_value, g.target_unit, g.target_date, g.status, 0 AS depth
      FROM public.goals g
     WHERE g.vision_plan_id = p_vision_id AND g.parent_goal_id IS NULL
    UNION ALL
    SELECT g.id, g.parent_goal_id, g.level::text, g.title,
           g.target_value, g.target_unit, g.target_date, g.status, gt.depth + 1
      FROM public.goals g
      JOIN goal_tree gt ON gt.id = g.parent_goal_id
  )
  SELECT jsonb_agg(to_jsonb(goal_tree)) INTO v_tree FROM goal_tree;

  RETURN jsonb_build_object(
    'vision_plan_id', p_vision_id,
    'tenant_id', v_tenant,
    'goals', COALESCE(v_tree, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.decompose_vision(uuid) TO authenticated;

-- ---------------------------------------------------------------------
-- 10) Financial: init_projections (3 cenarios placeholder)
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.init_projections(
  p_tenant_id uuid,
  p_horizon_years int DEFAULT 5
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_member(p_tenant_id, auth.uid()) THEN
    RAISE EXCEPTION 'Sem acesso ao tenant';
  END IF;

  IF p_horizon_years NOT IN (1,3,5) THEN
    RAISE EXCEPTION 'horizon_years deve ser 1, 3 ou 5';
  END IF;

  INSERT INTO public.financial_projections (tenant_id, scenario, horizon_years, inputs_json)
  VALUES
    (p_tenant_id, 'optimistic', p_horizon_years,
      '{"revenue_year1":0,"growth_rate":0.40,"ebitda_margin":0.25,"effective_tax":0.34}'::jsonb),
    (p_tenant_id, 'realistic',  p_horizon_years,
      '{"revenue_year1":0,"growth_rate":0.20,"ebitda_margin":0.15,"effective_tax":0.34}'::jsonb),
    (p_tenant_id, 'pessimistic',p_horizon_years,
      '{"revenue_year1":0,"growth_rate":0.05,"ebitda_margin":0.05,"effective_tax":0.34}'::jsonb)
  ON CONFLICT (tenant_id, scenario, horizon_years) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.init_projections(uuid, int) TO authenticated;

-- ---------------------------------------------------------------------
-- 11) K7: audit log RPC (tabela ja existe; aqui so o RPC de write)
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.log_event(
  p_tenant_id uuid,
  p_action text,
  p_entity_type text DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_member(p_tenant_id, auth.uid()) THEN
    RAISE EXCEPTION 'Sem acesso ao tenant';
  END IF;

  INSERT INTO public.audit_log (tenant_id, user_id, action, entity_type, entity_id, payload_json)
  VALUES (p_tenant_id, auth.uid(), p_action, p_entity_type, p_entity_id, COALESCE(p_payload, '{}'::jsonb))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_event(uuid, text, text, uuid, jsonb) TO authenticated;

-- Endurece policy de SELECT do audit_log para somente admin do tenant
DROP POLICY IF EXISTS "Members read audit" ON public.audit_log;
DROP POLICY IF EXISTS "Tenant admins read audit" ON public.audit_log;
DROP POLICY IF EXISTS "Members write audit" ON public.audit_log;
DROP POLICY IF EXISTS "Block direct write audit" ON public.audit_log;

CREATE POLICY "Tenant admins read audit" ON public.audit_log
  FOR SELECT TO authenticated
  USING (public.is_tenant_admin(tenant_id, auth.uid()));

-- INSERT direto bloqueado: forca uso do RPC log_event.
CREATE POLICY "Block direct write audit" ON public.audit_log
  FOR INSERT TO authenticated
  WITH CHECK (false);

COMMIT;

-- =====================================================================
-- VERIFICACAO POS-MIGRATION (executar manualmente, fora do BEGIN)
-- =====================================================================
-- 1) Verificar que helpers tem EXECUTE para authenticated:
--    SELECT proname, pg_get_function_arguments(oid) FROM pg_proc
--    WHERE proname IN ('is_member','is_tenant_admin','has_role')
--      AND pronamespace = 'public'::regnamespace;
--
-- 2) Verificar policies de memberships:
--    SELECT polname, polcmd, pg_get_expr(polqual, polrelid)
--    FROM pg_policy WHERE polrelid = 'public.memberships'::regclass;
--    -- esperado: 5 policies (SELECT own / SELECT admin / INSERT / UPDATE / DELETE)
--
-- 3) Trigger ligado em auth.users:
--    SELECT tgname, tgrelid::regclass FROM pg_trigger
--    WHERE tgname = 'on_auth_user_created';
--
-- 4) Smoke do bug original (logado como user x recem-criado):
--    SELECT * FROM public.memberships WHERE user_id = auth.uid();
--    -- esperado: 1+ row, ZERO permission denied
--
-- 5) Catalogos populados:
--    SELECT count(*) FROM public.ritual_templates;       -- esperado: 5
--    SELECT count(*) FROM public.framework_library;      -- esperado: 6
--    SELECT count(*) FROM public.role_templates
--      WHERE seniority IS NOT NULL;                      -- esperado: 7
--
-- 6) RPCs:
--    SELECT public.start_assessment('<tenant_uuid>');
--    SELECT public.compute_maturity_score('<tenant_uuid>',
--      '{"vision":[100,66,33],"okrs":[66,66,33],"rituals":[33,33,0],
--        "team":[100,66,66],"financial":[33,0,0]}'::jsonb);
--    -- esperado: linhas em maturity_assessments e maturity_recommendations
--
-- 7) RLS isolation:
--    -- Como user A: SELECT count(*) FROM public.memberships;
--    -- esperado: ve so as proprias.
