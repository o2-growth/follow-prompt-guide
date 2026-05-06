## Diagnóstico atual (página a página)

Hoje a IA (`generate-action-plan`) roda **uma vez ao final do onboarding** e o resultado só aparece no **PDF**. Nas telas, é tudo manual:

| Página | O que existe hoje | O que falta (vs. promessa do PDF) |
|---|---|---|
| Dashboard | Score geral + radar + atalhos | Nenhuma leitura do plano da IA. CEO entra e não vê "o que fazer agora". |
| Visão | 3 cards (5/3/1 ano) com North Star/Missão/Valores manuais | Sem sugestão da IA; o usuário tem razão — hoje a página é "preencha do zero", desconectada de crescimento/financeiro. |
| OKRs | CRUD de objetivos + KRs + check-in semanal | IA não sugere objetivos, KRs nem KPIs com base no diagnóstico. |
| Financeiro | DRE projetado 5 anos, 3 cenários, premissas únicas | Apenas 5 anos; sem 1 e 3 anos lado a lado; sem leitura/recomendação da IA sobre as premissas. |
| Time | Catálogo estático de papéis + headcount por faturamento | Sem priorização das contratações pela IA com base em maturidade + projeção financeira. |
| Rituais | Toggle de templates fixos | Sem sugestão da IA de quais ativar primeiro e por quê. |
| Maturidade Financeira | Empty state apontando para plataforma externa | OK (aguardando link externo). |
| Diagnóstico 360 | Empty state apontando para plataforma externa | OK. |
| Exportar PDF | Lista promete: capa, sumário, visão 5/3/1, OKRs, financeiro 3 cenários × 5 anos, time, rituais, **análise IA completa** | A "análise IA" no PDF existe mas é genérica e não bate com o que está nas telas (telas estão vazias da IA). |

**Veredito honesto:** o PDF promete entregar uma análise estratégica robusta, mas as telas ainda são "formulários em branco". A IA está confinada ao final. Precisa virar **camada transversal**: aparecer em cada página relevante, ancorada no diagnóstico do cliente.

---

## Plano de mudanças

### 1. IA por página (núcleo da entrega)

Criar **um endpoint por superfície** (não um monolito), porque cada um precisa de prompt + schema próprios e precisa rodar sob demanda:

- `ai-okrs-suggest` → recebe `tenant_id`; lê maturidade + visão + projeção + setor; devolve **3 objetivos sugeridos** com 2-4 KRs cada, KPIs de acompanhamento e justificativa baseada no resultado financeiro alvo.
- `ai-team-suggest` → contexto: faturamento atual, projeção realista 1/3/5a, maturidade time. Devolve **roadmap de contratações** (próximos 6m / 12m / 24m) por área, com seniority, custo aproximado, motivo (gargalo de receita, processo, etc).
- `ai-financial-analyze` → lê premissas atuais + setor + projeções; devolve **leitura crítica das premissas** (crescimento realista? margem coerente?), riscos, alavancas e **recomendação de cenário ideal para 1, 3 e 5 anos** com metas intermediárias.
- `ai-rituals-suggest` → devolve quais rituais ativar primeiro, em que ordem, e por quê (baseado em maturidade rituais + tamanho time).
- `ai-vision-suggest` → devolve North Star/Missão refinados conectados à projeção financeira.
- `ai-maturity-coach` (página Maturidade Financeira local, opcional) → leitura textual do score após preenchido.

Reaproveitar o pattern de `generate-action-plan` (membership check, tool calling, persistência). Persistir em uma tabela única `ai_suggestions` (`tenant_id, surface, content_json, status, generated_at`) — uma row por superfície, sobrescrita ao regenerar.

**UI por página:**
- Card `<AIInsightPanel>` reutilizável no topo de cada página afetada, com:
  - Estado vazio: botão "Gerar análise da IA"
  - Estado pronto: resumo + sugestões + botão "Aplicar" (ex.: cria os OKRs sugeridos com 1 clique) e "Regerar"
  - Loading + tratamento de 429/402 (toast amigável)

### 2. Repensar a página "Visão"

Concordo com o usuário: hoje Visão é abstrata e desconectada. Duas opções:

- **A) Manter, mas reposicionar** como "Norte estratégico" — o card de cada horizonte mostra North Star + **a meta financeira correspondente vinda da projeção** (Ano 1 / Ano 3 / Ano 5) e os OKRs/contratações ligados. Ela vira o "amarrador" entre financeiro, OKRs e time. **(Recomendado.)**
- **B) Remover** e mover North Star/Missão/Valores para um bloco menor dentro de Configurações. PDF ainda usa.

Esperar decisão do usuário antes de mexer (ver questions abaixo).

### 3. Aprofundar Financeiro (1 / 3 / 5 anos)

- Hoje só `HORIZON = 5`. Mudar para **3 horizontes paralelos (1, 3, 5)** com mesmas premissas-base mas exibidos em **3 abas de horizonte × 3 cenários**.
- Adicionar campos extras nas premissas: **CAC, ticket médio, churn, headcount** — necessários para a IA fazer leitura útil e cruzar com Time.
- Persistir em `financial_projections` que já suporta `horizon_years` — basta gerar as rows 1 e 3 também via `init_projections` adaptado.
- Card de IA no topo: "Leitura das premissas + cenário ideal recomendado".

### 4. Alinhar promessa do PDF com a realidade

Atualizar a lista de bullets em `ExportPDF.tsx` para refletir o que de fato sai (e o que vamos entregar):

- Capa branded
- Sumário executivo (score + top 3 prioridades + top 3 frameworks)
- **Análise IA por dimensão** (uma seção por página: visão, OKRs, financeiro, time, rituais)
- Visão 5/3/1 ligada às metas financeiras
- OKRs vigentes + OKRs sugeridos pela IA (com KPIs)
- Projeção financeira **1/3/5 anos × 3 cenários** + leitura crítica da IA
- Roadmap de contratações priorizado
- Rituais ativos + sugeridos
- Plano de 90 dias

O PDF passa a ler de `ai_suggestions` (uma seção por superfície) em vez de só `ai_action_plans`. Mantemos `generate-action-plan` como "rodar tudo de uma vez" no final do onboarding e em "Regerar tudo" no PDF.

### 5. Dashboard

Adicionar um card "Próximas ações sugeridas pela IA" lendo de `ai_suggestions` — top 3 itens cross-surface, com link para a página correspondente.

---

## Detalhes técnicos

- **Tabela nova:** `ai_suggestions(id, tenant_id, surface text, status text, content_json jsonb, model, generated_at, created_at, updated_at)` + UNIQUE(tenant_id, surface) + RLS members read / block direct write.
- **Edge functions novas:** 5 funções (1 por surface) compartilhando helper de contexto. Modelo padrão `google/gemini-2.5-pro` (qualidade) ou `google/gemini-3-flash-preview` (custo) — começar com flash e subir se a qualidade pedir.
- **Tool calling** com schemas estritos por surface (mesmo padrão do `generate-action-plan`).
- **Trigger automático:** ao concluir onboarding, disparar todas as 5 em paralelo (e o `generate-action-plan` continua para o resumo executivo do PDF).
- **`generate-action-plan`** passa a também popular `ai_suggestions` por surface no mesmo run, para evitar duplicar custo.
- **Componente `<AIInsightPanel>`** em `src/components/ai/AIInsightPanel.tsx` parametrizado por `surface` + render slot por tipo de conteúdo.
- **Aplicar sugestão:** mutações que criam OKRs / ativam rituais / preenchem Visão a partir do JSON da IA (1 clique).

---

## Antes de implementar

Tenho 2 dúvidas para fechar o escopo:
