# Strategic OS

[![CI](https://github.com/o2-growth/follow-prompt-guide/actions/workflows/ci.yml/badge.svg)](https://github.com/o2-growth/follow-prompt-guide/actions/workflows/ci.yml)

Plataforma SaaS multi-tenant para CEOs de empresas mid-market (R$10M–R$200M ARR)
estruturarem **visão 5/3/1 anos**, **OKRs**, **DRE projetado** e **rituais de gestão**
em uma única hora. Stack Vite + React + Supabase, hospedado em Lovable Cloud.

**Live:** https://strategicos.lovable.app
**Repo:** https://github.com/o2-growth/follow-prompt-guide

---

## Como rodar local

Pré-requisitos: [Bun](https://bun.sh) (`curl -fsSL https://bun.sh/install | bash`).

```bash
# 1. Clonar e instalar
git clone https://github.com/o2-growth/follow-prompt-guide.git strategic-os
cd strategic-os
bun install

# 2. Copiar variáveis de ambiente
cp .env.example .env
# Edite .env com a URL e anon key reais do Supabase
# (Settings → API no dashboard do projeto)

# 3. Rodar dev server
bun dev
# → http://localhost:5173
```

## Variáveis de ambiente

Veja [`.env.example`](./.env.example) para a lista completa.
Documentação detalhada (rotação, ambientes, segurança): [`SECRETS.md`](./SECRETS.md).

| Var | Obrigatória | Descrição |
|-----|-------------|-----------|
| `VITE_SUPABASE_URL` | sim | URL do projeto Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | sim | Anon key (RLS protege) |
| `VITE_SUPABASE_PROJECT_ID` | sim | Identificador do projeto |
| `VITE_SENTRY_DSN` | não | DSN do Sentry para captura de erros |

## Observabilidade

- **Sentry** — frontend instrumentado em [`src/lib/sentry.ts`](./src/lib/sentry.ts).
  Configure `VITE_SENTRY_DSN` em `.env` (dev) ou Lovable Cloud (prod). Sem DSN: no-op.
- **Healthcheck** — Edge Function em [`supabase/functions/healthcheck/`](./supabase/functions/healthcheck/).
  URL prod: `https://rzzxlaknknrqfvbsfelx.supabase.co/functions/v1/healthcheck`.
- **UptimeRobot** — instruções em [`supabase/functions/healthcheck/README.md`](./supabase/functions/healthcheck/README.md).

## Scripts

```bash
bun dev          # vite dev server
bun run build    # production build
bun run lint     # eslint
bun run test     # vitest
bunx tsc --noEmit  # typecheck
```

## CI

GitHub Actions roda lint + typecheck + build + smoke e2e em cada PR e push para `main`.
Config: [`.github/workflows/ci.yml`](./.github/workflows/ci.yml).

## Deploy

Auto-deploy do branch `main` via Lovable Cloud.
Edge Functions deploy manual:

```bash
supabase functions deploy healthcheck --no-verify-jwt
```

## Estrutura

```
src/
  components/     # UI compartilhada (shadcn/ui)
  pages/          # Rotas (Vision, Okrs, Financial, Maturity, Rituals, …)
  integrations/   # Supabase client
  lib/            # utils, sentry init
supabase/
  migrations/     # SQL versionado (dono: Dara)
  functions/      # Edge Functions
docs/             # PRD, arquitetura, decisões
qa/               # Smoke tests e fixtures
```

## Squad

| Agente | Função |
|--------|--------|
| Orion | Master orchestrator |
| Aria | System architect / CTO |
| Dex | Full-stack dev |
| Uma | UX/UI |
| Dara | Database / migrations |
| Gage | DevOps / CI / secrets |
| Quinn | QA |
| Morgan | Product |
| River | Scrum master |

## Licença

Proprietário — O2inc / G4 Educação. Todos os direitos reservados.
