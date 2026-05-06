## Objetivo

1. Adicionar campo **telefone obrigatório** no cadastro (Signup).
2. Após signup bem-sucedido, criar automaticamente um **card no Pipefy** (pipe `304018800`, fase "Eventos") com os dados do lead, incluindo `Tipo de Origem do lead = Eventos` e `Origem do lead = G4 São Paulo - 6 de Maio`.
3. Falha no Pipefy **não bloqueia** o signup — erro vai para log e `audit_log`.

---

## Mudanças

### 1. Banco

Adicionar coluna `phone` em `user_profiles` e atualizar `handle_new_user` para persistir o telefone vindo do `raw_user_meta_data`.

```sql
ALTER TABLE public.user_profiles ADD COLUMN phone text;
```
Atualizar `handle_new_user()` para incluir `phone := NEW.raw_user_meta_data->>'phone'` no INSERT do profile.

### 2. Frontend — `src/pages/auth/Signup.tsx`

- Novo campo `<Input type="tel">` "Telefone (WhatsApp)" com máscara BR `(11) 99999-9999`, obrigatório, validação mínima de 10 dígitos.
- Passar `phone` em `options.data` do `supabase.auth.signUp`.
- Após `signUp` retornar OK, invocar edge function `pipefy-create-lead` (não bloqueante — `.catch` apenas loga via Sentry).

### 3. Secret

Solicitar via `add_secret` o token Pipefy: **`PIPEFY_API_TOKEN`** (Personal Access Token gerado em Pipefy → Configurações → Tokens pessoais).

### 4. Edge Function — `supabase/functions/pipefy-create-lead/index.ts`

- Validação JWT (`getClaims`) — só usuário logado pode disparar para si mesmo.
- Busca `user_profiles` (nome, telefone) + `auth.users` (email) via service role.
- Chama Pipefy GraphQL API:
  ```
  POST https://api.pipefy.com/graphql
  Headers: Authorization: Bearer ${PIPEFY_API_TOKEN}
  ```
- Mutation `createCard` no `pipe_id: 304018800`, com `phase_id` da fase "Eventos" (descoberto via query `pipe(id:){phases{id name}}` no primeiro deploy — guardado como constante; se "Eventos" não existir, usa fase inicial e loga warning).
- `fields_attributes`: nome, email, telefone, `tipo_de_origem_do_lead = "Eventos"`, `origem_do_lead = "G4 São Paulo - 6 de Maio"`.
- Em sucesso: `log_event('pipefy_card_created', payload={card_id})`.
- Em falha: `log_event('pipefy_card_failed', payload={error})` + retorna 200 (não bloqueia signup) com `{ok:false, error}`.

### 5. Validação

- Smoke: criar conta de teste com telefone → ver card aparecer no pipe Pipefy 304018800 fase Eventos.
- Ver `audit_log` para `pipefy_card_created`.
- Forçar erro (token inválido) e confirmar que signup ainda completa.

---

## Detalhes técnicos

- Field IDs do Pipefy são gerados pelo nome do campo (slug). Como não temos acesso ao schema do pipe, a edge function vai primeiro fazer um `pipe(id:304018800){start_form_fields{id label}}` na primeira invocação, cachear em memória do worker, e mapear nomes ("Nome", "E-mail", "Telefone", "Tipo de Origem do lead", "Origem do lead") → `id`. Se algum campo não bater, loga e segue com os que casaram.
- Telefone armazenado como string só com dígitos no metadata; máscara só visual.
- Não vamos pedir telefone para usuários que entram via Google OAuth nesta primeira versão (o fluxo OAuth não tem campo). Pode ser adicionado depois com um modal pós-callback se você quiser.

## Fora do escopo

- Atualizar telefone depois do cadastro (Settings).
- Sincronizar mudanças de profile com o card Pipefy.
- Mover card entre fases conforme onboarding.
