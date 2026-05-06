## Reorganizar a seção "O que você vai construir" em 3 módulos

Substituir a grade de 6 cards por **3 cards grandes** representando os pilares Estratégico, Tático e Operacional. Linguagem simples para CEO de PME.

### Mudança em `src/pages/Landing.tsx`

Trocar a constante `FEATURES` (atual: 6 itens) e a renderização da grade por:

```text
ESTRATÉGICO  →  ícone Compass · "Para onde vamos"
                Visão 5/3/1, north star e diagnóstico de maturidade
                em 5 dimensões.

TÁTICO       →  ícone Target · "Como vamos chegar lá"
                OKRs trimestrais com KRs mensuráveis e estrutura
                de time com frameworks (SPIN, MEDDIC, RACI).

OPERACIONAL  →  ícone CalendarCheck · "O que fazemos toda semana"
                Rituais (daily, weekly, 1:1, monthly, quarter)
                com agenda e check-ins.
```

- Eyebrow continua "O que você vai construir".
- Título troca para algo mais simples: **"Três níveis. Um plano só."**
- Grid passa de `md:grid-cols-3` 6 cards para `md:grid-cols-3` 3 cards (cada card maior, mais respirável).
- Mantém o estilo dos cards atuais (mesmo radius 12px, ícone em pill lima, texto Tusker no título).
- Remove ícones agora não usados do import (`Users2`, `Gauge` se ficarem órfãos).

### O que NÃO muda

- Sidebar, rotas, telas internas (Vision/OKRs/Team/Rituals/Maturity/Financial) ficam exatamente como estão.
- Hero, header, restante da landing intactos.
- Nenhuma migração de banco.

Confirma?
