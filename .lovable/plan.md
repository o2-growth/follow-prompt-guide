## Limpeza da Landing

Duas remoções pequenas em `src/pages/Landing.tsx`:

1. **Tirar "DRE projetado" da landing** — aparece em 2 lugares:
   - Linha 9: card de feature `{ icon: TrendingUp, title: "DRE projetado", desc: "Três cenários financeiros e gap meta vs. projeção." }` → **removo o card inteiro** (a grade ajusta sozinha).
   - Linha 42: na frase "visão, OKRs, DRE projetado, estrutura de time e rituais" → fica **"visão, OKRs, estrutura de time e rituais"**.

2. **Remover "Sem cadastro de cartão. Acesso pleno."** (linha 54) — apago o `<p>` inteiro.

Sem outras mudanças. Não toco no resto da página, no produto Financial nem no PDF.

Confirma para aplicar?
