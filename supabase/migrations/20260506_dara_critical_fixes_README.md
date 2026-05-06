# Migration 20260506_dara_critical_fixes

**Owner:** Dara (Data Engineer / Database Architect)
**Data:** 2026-05-06
**Tipo:** Bugfix critico + features de schema (consolidada)

---

## Resumo executivo

Esta migration:
1. **Conserta BUG-001** (RLS 403 em `memberships` apos signup) — a migration anterior `20260506034928` revogou `EXECUTE` em `is_member` / `is_tenant_admin` / `has_role` de `authenticated`, quebrando todas as policies que dependem desses helpers.
2. **Reescreve policies de `memberships`** em 5 policies separadas (SELECT own / SELECT admin / INSERT / UPDATE / DELETE) para eliminar dependencia de helper na consulta "ver as proprias memberships".
3. **Endurece `handle_new_user`**: adiciona `EXCEPTION WHEN OTHERS` (nao silencia, mas nao bloqueia signup), garante DEFAULT em `tenants.name`, e re-cria o trigger.
4. **RPC fallback `ensure_tenant_for_user()`** — idempotente; o front pode chamar logo apos sessao para garantir tenant mesmo se o trigger tiver falhado em algum momento.
5. **C6 fix:** RLS bloqueia escrita direta em `user_roles`; cria RPCs `assign_app_role` / `revoke_app_role` (SECURITY DEFINER) com bootstrap do primeiro admin.
6. **I7 fix:** novas tabelas globais read-only `ritual_templates` (5 seeds) e `framework_library` (6 seeds: SPIN, MEDDIC, RACI, OKR, BANT, Eisenhower).
7. **I10 fix:** adiciona `seniority`, `recommended_headcount_by_revenue`, `framework_keys` em `role_templates` + atualiza os 7 seeds existentes.
8. **I2 fix:** RPCs `start_assessment(p_tenant_id)` e `compute_maturity_score(p_tenant_id, p_answers)` — fonte unica de verdade pra perguntas e scoring.
9. **K6 fix:** `compute_maturity_score` agora popula `maturity_recommendations` automaticamente (3 faixas de score: <40, 40-69, >=70).
10. **K7 fix:** RPC `log_event(...)` para escrever em `audit_log`. Policy de SELECT restrita a tenant admin; INSERT direto bloqueado (forca uso do RPC).
11. **Goals cascade:** RPC `decompose_vision(p_vision_id)` retorna arvore vision -> goals (annual/quarter/month/week) usando recursive CTE.
12. **Financial:** RPC `init_projections(p_tenant_id, p_horizon_years)` cria 3 cenarios placeholder (otimista/realista/pessimista).

---

## Causa raiz do BUG-001 (definitivo)

A primeira migration criou `is_member` e `is_tenant_admin` corretamente (SECURITY DEFINER, search_path travado). A **segunda migration** rodou:

```sql
REVOKE EXECUTE ON FUNCTION public.is_member(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_tenant_admin(uuid, uuid) FROM PUBLIC, anon, authenticated;
```

Isso parece sensato (defesa em profundidade), **MAS** as RLS policies em `memberships`, `tenants`, `goals`, etc. invocam essas funcoes na expressao `USING/WITH CHECK`. Em PostgreSQL a expressao da policy e avaliada como o role do caller (`authenticated`), entao precisa de `EXECUTE`. Sem ele, qualquer query sobre `memberships` pelo cliente devolve `42501 permission denied for function`, que o PostgREST traduz em **HTTP 403**.

A policy original era `(user_id = auth.uid()) OR is_tenant_admin(tenant_id, auth.uid())` — em tese o OR poderia curto-circuitar quando `user_id = auth.uid()` ja era verdadeiro, mas **o planner do PostgreSQL nao garante short-circuit em policies RLS** (depende do plano), entao o `EXECUTE` ainda eh exigido em muitos casos.

**Fix:** GRANT EXECUTE seletivo de volta para `authenticated` + reescrita das policies em duas SELECT separadas (uma so com `user_id = auth.uid()`, outra com `is_tenant_admin(...)`) — assim a "ver as proprias memberships" nao depende de funcao alguma e o 403 some mesmo se algum helper for revogado de novo no futuro.

---

## Mudancas de schema

### Tabelas novas
- `public.ritual_templates` (id text PK, kind, name, agenda_json, etc.) — RLS read-only para `authenticated`.
- `public.framework_library` (key text PK, name, category, description_md, template_md, example_md, when_to_apply) — RLS read-only.

### Alteracoes
- `public.tenants.name` — DEFAULT `'Meu Workspace'`.
- `public.role_templates` — `+ seniority text`, `+ recommended_headcount_by_revenue jsonb`, `+ framework_keys text[]`.
- `public.audit_log` — policy SELECT restrita a `is_tenant_admin`; policy INSERT direta bloqueada.
- `public.memberships` — todas as policies recriadas (5 policies novas, 2 antigas dropadas).
- `public.user_roles` — policy SELECT preservada; policy de bloqueio explicita de write adicionada.

### Funcoes novas / atualizadas
- `is_member(uuid, uuid)`, `is_tenant_admin(uuid, uuid)` — re-criadas (CREATE OR REPLACE) com `SECURITY DEFINER` + `search_path = public`. **GRANT EXECUTE para authenticated restaurado.**
- `is_member(uuid)`, `is_tenant_admin(uuid)` — overloads de 1-arg que injetam `auth.uid()` (atende a assinatura mencionada no AGENT_PERSONA).
- `handle_new_user()` — re-criada com `BEGIN/EXCEPTION/END` interno + `RAISE WARNING` em vez de falha silenciosa.
- `ensure_tenant_for_user()` — RPC fallback idempotente.
- `assign_app_role(uuid, app_role)`, `revoke_app_role(uuid, app_role)` — gerencia `user_roles` (C6).
- `start_assessment(uuid)` — devolve 15 perguntas estruturadas (3 por dimensao).
- `compute_maturity_score(uuid, jsonb)` — calcula scores e popula `maturity_assessments` + `maturity_recommendations`.
- `decompose_vision(uuid)` — arvore goals via CTE recursiva.
- `init_projections(uuid, int)` — cria 3 cenarios placeholder.
- `log_event(uuid, text, text, uuid, jsonb)` — escrita em `audit_log` via RPC.

### Triggers
- `on_auth_user_created` em `auth.users` — DROP+CREATE para garantir que esta ligado.

---

## Como aplicar

### Lovable (auto-apply)
Ao push do repo, Lovable detecta a nova migration em `supabase/migrations/20260506_dara_critical_fixes.sql` e aplica no projeto Supabase remoto automaticamente.

### Manual via Supabase CLI
```bash
cd /Users/andreylopes/strategic-os/repo
supabase db push
```

### Manual via SQL editor (Supabase Dashboard)
Cole o conteudo de `20260506_dara_critical_fixes.sql` no SQL editor e clique Run. O arquivo eh 100% idempotente (re-execucao nao quebra).

---

## Smoke test pos-aplicacao

Bloco de teste comentado no fim do arquivo SQL. Resumo:

1. **Memberships sem 403** (logado como user x):
   ```sql
   SELECT * FROM public.memberships WHERE user_id = auth.uid();
   ```
   Esperado: 1+ row (a membership do tenant criado no signup), zero erro.

2. **Catalogos populados:**
   ```sql
   SELECT count(*) FROM public.ritual_templates;       -- 5
   SELECT count(*) FROM public.framework_library;      -- 6
   SELECT count(*) FROM public.role_templates WHERE seniority IS NOT NULL;  -- 7
   ```

3. **Maturity RPC end-to-end:**
   ```sql
   SELECT public.compute_maturity_score(
     '<tenant_uuid>'::uuid,
     '{"vision":[100,66,33],"okrs":[66,66,33],"rituals":[33,33,0],"team":[100,66,66],"financial":[33,0,0]}'::jsonb
   );
   SELECT count(*) FROM public.maturity_recommendations
     WHERE tenant_id = '<tenant_uuid>'::uuid;          -- esperado: 5 (uma por dimensao)
   ```

4. **Signup E2E** (front + Supabase): criar conta nova em `/auth/signup` e abrir Network tab. Esperado: GET `/rest/v1/memberships?...` devolve 200 com 1 row, sem 403.

---

## Rollback

A migration nao faz DROP destrutivo; o caminho seguro de rollback eh:

```sql
BEGIN;

-- desfaz GRANTs (volta ao estado pos-migration 2)
REVOKE EXECUTE ON FUNCTION public.is_member(uuid, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_tenant_admin(uuid, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated;

-- (opcional) drop das novas tabelas globais
DROP TABLE IF EXISTS public.ritual_templates CASCADE;
DROP TABLE IF EXISTS public.framework_library CASCADE;

-- drop dos RPCs novos
DROP FUNCTION IF EXISTS public.assign_app_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.revoke_app_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.start_assessment(uuid);
DROP FUNCTION IF EXISTS public.compute_maturity_score(uuid, jsonb);
DROP FUNCTION IF EXISTS public.decompose_vision(uuid);
DROP FUNCTION IF EXISTS public.init_projections(uuid, int);
DROP FUNCTION IF EXISTS public.log_event(uuid, text, text, uuid, jsonb);
DROP FUNCTION IF EXISTS public.ensure_tenant_for_user();

COMMIT;
```

**Atencao:** rollback NAO desfaz as colunas adicionadas em `role_templates` (seniority, etc.) — front pode contar com elas. Se precisar reverter, use `ALTER TABLE ... DROP COLUMN`.

---

## Pontos de atencao para o squad

### Para Dex (frontend)
- **Onboarding step 2 (diagnostico):** parar de inserir direto em `maturity_assessments`. Trocar por `supabase.rpc('compute_maturity_score', { p_tenant_id, p_answers })` — payload e `{ "vision":[v1,v2,v3], "okrs":[...], ... }` (arrays de numeros 0/33/66/100). O RPC retorna `{ tenant_id, results: [...], overall }` e ja popula `maturity_recommendations`.
- **Onboarding step 1 (perguntas):** se quiser fonte unica de verdade, trocar o array hardcoded das 15 perguntas por `supabase.rpc('start_assessment', { p_tenant_id })` na montagem do step.
- **Rituals.tsx:** trocar o array hardcoded por `supabase.from('ritual_templates').select('*').order('display_order')`.
- **Frameworks (Team.tsx):** ler `framework_library` para mostrar description/template/example completos no expand.
- **Dashboard / Settings (BUG-005, BUG-007):** apos sessao, chamar `supabase.rpc('ensure_tenant_for_user')` no boot do AuthContext — protege contra race onde o trigger nao concluiu antes do primeiro fetch de `memberships`. Idempotente, seguro de chamar sempre.
- **Audit log:** trocar `INSERT INTO audit_log` (que agora esta bloqueado por RLS) por `supabase.rpc('log_event', {...})`.
- **role_templates:** novas colunas `seniority`, `framework_keys`, `recommended_headcount_by_revenue` ja vem populadas para os 7 seeds — front pode usar pra renderizar headcount sugerido por faixa de receita.
- **Onboarding step OKR / financial:** apos onboarding completar, chamar `supabase.rpc('init_projections', { p_tenant_id, p_horizon_years: 5 })` pra ja popular os 3 cenarios.

### Para Quinn (QA)
- Smoke priority: re-rodar BUG-001 repro (signup -> dashboard -> ver Network) e confirmar zero 403.
- Validar que dois usuarios com tenants distintos nao se enxergam (`memberships`, `goals`, `okrs_objectives`).

### Para Aria/Orion
- O RPC `assign_app_role` tem **bootstrap aberto**: se nao existir nenhum admin, qualquer authenticated pode promover **a si mesmo**. Apos primeiro deploy, executar `SELECT public.assign_app_role(auth.uid(), 'admin')` logado como Andrey/CEO para travar.
- Audit log INSERT direto agora retorna 403; qualquer codigo que ainda fizer `from('audit_log').insert(...)` precisa migrar pra RPC.

---

## Risco da migration

| Risco | Severidade | Mitigacao |
|---|---|---|
| GRANT EXECUTE em is_member/is_tenant_admin volta a authenticated (mais permissivo que migration 2) | Baixo | Funcoes sao SECURITY DEFINER, nao retornam dado bruto; so booleano. Sem vetor de exfil. |
| Policy SELECT nova em memberships permite ver own row sem helper | Baixo | Comportamento esperado. Antes ja era a intencao do OR, so estava quebrada. |
| `handle_new_user` agora swallow exception (RAISE WARNING) | Medio | Se trigger falhar, o user fica sem tenant. RPC `ensure_tenant_for_user` cobre. Logs do Postgres mostram falha pra debug. |
| `audit_log` INSERT direto bloqueado | Medio | Quebra qualquer codigo legado que ainda fizer INSERT direto. Forca uso do RPC `log_event`. |
| RPC `assign_app_role` permite bootstrap do primeiro admin sem auth | Baixo | Janela curta (so antes de existir qualquer admin). CEO deve promover-se imediatamente apos deploy. |
| ALTER TABLE em `role_templates` adiciona 3 colunas com DEFAULT | Baixo | DEFAULT nao reescreve linhas (Postgres 11+); operacao instant. UPDATEs subsequentes sao por linha mas tabela tem 7 rows. |

Sem DROP CASCADE, sem CHANGE TYPE, sem politica mais permissiva alem do que a migration 1 ja tinha.
