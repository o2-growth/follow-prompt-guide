# Secrets & Environment Variables

> **Owner:** Gage (DevOps)
> **Última atualização:** 2026-05-06

## Variáveis em uso

Todas estão prefixadas com `VITE_` — Vite as expõe ao bundle do navegador.
**Nunca** prefixe com `VITE_` qualquer chave que precise permanecer privada
(ex.: `service_role`, `stripe_secret`, etc.). Essas devem viver apenas em
Edge Functions / variáveis de ambiente do Supabase.

| Var | Tipo | Onde usar | Sensível? |
|-----|------|-----------|-----------|
| `VITE_SUPABASE_URL` | URL pública | Frontend | Não |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Anon key (JWT) | Frontend | Tecnicamente público (RLS protege) — mas tratar como segredo operacional |
| `VITE_SUPABASE_PROJECT_ID` | Identificador | Frontend | Não |
| `VITE_SENTRY_DSN` | DSN | Frontend | Tratar como segredo operacional |

## Como rotacionar a Anon Key (Supabase)

1. Supabase Dashboard → **Settings → API**
2. Clique em **Reset anon key** (ou regenerate JWT secret se for emergência total)
3. Copie a nova key para o `.env` local
4. Atualize a env var no provedor (Lovable Cloud → Project Settings → Environment)
5. Re-deploy o frontend
6. Verifique a UI — login deve funcionar

> Anon key tem `iat`/`exp` longos (default 10 anos). Rotacione apenas se houver suspeita de exposição indevida (ex.: chave em log público, repo aberto antes da limpeza).

## Como rotacionar Service Role Key

> **Service Role NUNCA deve estar no `.env` do frontend.** Use somente em Edge Functions / scripts server-side.

1. Supabase Dashboard → **Settings → API → Reset service_role key**
2. Atualizar nas Edge Functions: `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...`
3. Atualizar em qualquer pipeline CI/CD
4. Auditar logs do Supabase para uso da chave antiga nas últimas 24h

## Histórico de exposição

- **2026-05-06:** `.env` estava versionado no Git desde o scaffold Lovable inicial. Removido do tracking (`git rm --cached .env`) — ainda existe no histórico do branch `main`. Como contém apenas anon key + URL (públicos por design), **não foi rotacionado**.
- Se em algum momento futuro um `service_role` ou similar for commitado por engano, executar **manualmente** (NÃO automatize):

```bash
# DANGER — reescreve histórico. Coordenar com todo o time antes.
git filter-repo --invert-paths --path .env --force
git push origin --force --all
git push origin --force --tags
```

E em paralelo: rotacionar a chave imediatamente no Supabase Dashboard.

## Onde configurar cada ambiente

| Ambiente | Onde guardar |
|----------|--------------|
| Local dev | `.env` (gitignored) |
| Lovable Cloud (prod) | Lovable Project Settings → Environment Variables |
| Edge Functions | `supabase secrets set KEY=value` |
| GitHub Actions | Repository Settings → Secrets and variables → Actions |
