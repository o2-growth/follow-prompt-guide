## De onde a IA está tirando essas recomendações

Já abri seu tenant (`Empresa do joao`, Serviços B2B, 1–10, até R$1M) e a única `ai_suggestion` salva é a de **OKRs**, gerada hoje. Os números que apareceram pra você (R$25k→R$75k MRR, 40→120 SQLs, NPS 60→75, PMR 45→30, Margem 40→50%) **não vêm do banco** — não existe nenhum dado financeiro, funil, NPS ou rituais cadastrados. A IA inventou baselines plausíveis a partir de:

1. **Contexto enviado pelo edge function `ai-suggest`** (real, do banco):
   - Empresa: Serviços B2B, 1–10 pessoas, faturamento até R$1M
   - Maturidade: vision 44, okrs 66, rituals 66, team 66, financial 66
   - Visão 5 anos: "Faturando 2 milhões por mês", missão "Elevar o nível de entrega e transformar o comercial", valores [excelência, intensidade]
   - OKR atual: "Alcançar 500 mil de MRR com NPS 75" + KR "100 novos clientes ticket 5k/mês"
   - **Vazio**: projeções financeiras, rituais ativos, papéis, check-ins
2. **System prompt + SURFACE_PROMPT** ("estrategista G4+O2inc, gere 3 objetivos com KRs mensuráveis…").
3. **Alucinação do modelo** (`google/gemini-2.5-pro`) preenchendo baselines/metas que não existem (R$25k MRR, NPS 60, PMR 45 dias). Esse é o problema central — sem `user_focus` nem dados reais, o modelo chuta.

## O que vou fazer (auditoria completa)

Como você pediu, vou **disparar a IA em todas as 5 superfícies** (`okrs`, `team`, `financial`, `rituals`, `vision`) chamando o edge function autenticado como você, ler o que ele salva em `ai_suggestions`, e montar um **relatório lado-a-lado**:

| Superfície | O que a IA gerou | O que existe no seu banco | Veredito |
|---|---|---|---|
| OKRs | objetivos/KRs/baselines | OKRs reais cadastrados | confere ou inventou? |
| Team | papéis recomendados | `org_charts`, papéis salvos | confere? |
| Financial | premissas, cenário 1/3/5 anos | `financial_projections`, `dre_line_items` | confere? |
| Rituals | rituais sugeridos + ordem | `rituals` ativos | confere? |
| Vision | refino 5/3/1 ano | `vision_plans` (5 anos) | confere? |

### Como vou rodar

1. **Disparar via `supabase--curl_edge_functions`** (passa seu token de preview automaticamente) cada uma das 5 superfícies, esperando cada uma terminar (`status: ready`).
2. **Ler `ai_suggestions`** do seu `tenant_id` (`3bb6d59d-…`) com todos os `content_json`.
3. **Ler todas as tabelas-fonte** (`tenants`, `vision_plans`, `okrs_objectives`+`key_results`, `financial_projections`+`dre_line_items`, `rituals`, `org_charts`, `maturity_assessments`).
4. **Gerar `/mnt/documents/auditoria-ia.md`** com:
   - Para cada superfície: bloco "IA disse" vs "banco tem"
   - Marcadores ⚠️ onde a IA inventou número que não existe no banco (baseline/meta/KPI sem fonte)
   - ✅ onde casa com dado real
   - Resumo final: % de "alucinação" por superfície + recomendação técnica (adicionar `user_focus`, baixar temperatura, exigir "se não tiver dado, dizer N/D")

### Observações técnicas

- Nenhuma alteração de código nesta task — é só auditoria.
- O modelo é **`google/gemini-2.5-pro`** (linha 196 do `ai-suggest/index.ts`), via Lovable AI Gateway.
- Custa ~5 chamadas de IA (uma por superfície). Sem `user_focus` ainda — esta rodada serve justamente pra você ver o tamanho do problema antes de decidir se aplicamos a correção que ficou pendente (campo `user_focus` + prompt mais rígido).

Confirma que pode rodar?
