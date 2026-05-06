## Objetivo

Tirar a inconsistência cromática da landing: o degradê verde difuso no hero e a faixa cinza-clara do PDF callout. Restabelecer ritmo dark editorial usando só 3 tons da marca + lima como único acento.

---

## Paleta final (consistente top→bottom)

| Token | Hex | Uso |
|---|---|---|
| `ink-900` | `#1A1A1A` | Hero, PDF callout (faixas "fortes") |
| `background` | `#3A3A3A` | Pillars, body padrão (respiro) |
| `card` | `#242424` | Cards dos pillars |
| `lima-400` | `#63F161` | Único acento |
| `off-white` | `#FAFAFA` | Texto |

Ritmo: **escuro (hero) → médio (pillars) → escuro (PDF) → médio (footer)**. Nada de cinza-claro alienígena, nada de gradient verde difuso.

---

## Mudanças

### 1. `src/index.css` — tokens

- **Remover `--gradient-hero`** (verde radial). Substituir por:
  - `--ink-900: 0 0% 10%;` (novo token HSL)
  - `--gradient-grid:` linear-gradient sutil só pro pattern blueprint (linhas finas em `hsl(0 0% 100% / 0.04)`).
- Manter `--gradient-gold` (usado em ícones) e `--gradient-surface` (usado em cards).

### 2. `tailwind.config.ts`

- Adicionar `ink: { 900: 'hsl(var(--ink-900))' }` em `colors`.

### 3. `src/pages/Landing.tsx` — hero

- Trocar `gradient-hero` por `bg-ink-900 relative overflow-hidden`.
- Adicionar dois elementos decorativos (absolute, pointer-events-none):
  - **Grid blueprint**: `bg-[linear-gradient(...)] bg-[size:48px_48px] opacity-[0.06]` — linhas finas verticais+horizontais cobrindo todo o hero, fade-out radial nas bordas via mask.
  - **Halo lima**: `radial-gradient(circle at 20% 40%, hsl(119 84% 66% / 0.18), transparent 55%)` — luz intencional atrás do H1.
- Eyebrow mono mais presente (já existe a pill, manter).

### 4. `src/pages/Landing.tsx` — PDF callout

- Trocar `bg-muted/40 border-y border-border` por `bg-ink-900 border-y border-accent/20`.
- Manter ícone lima e tipografia.
- Remover qualquer fundo cinza-claro residual.

### 5. `src/pages/Landing.tsx` — pillars (sem mudança de cor)

- Mantém `bg-background` (#3A3A3A). Cards continuam `bg-card`.
- Pequeno ajuste opcional: borda dos cards de `border-border` (que é branco c/ alpha 0.10) pra `border-white/5` explícito — só pra garantir que não puxe outro tom.

### 6. Footer

- Mantém. Já está consistente.

---

## Detalhes técnicos

- Grid blueprint via inline style ou utility:
  ```
  background-image:
    linear-gradient(to right, hsl(0 0% 100% / 0.05) 1px, transparent 1px),
    linear-gradient(to bottom, hsl(0 0% 100% / 0.05) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: radial-gradient(ellipse at center, black 40%, transparent 80%);
  ```
- Halo lima: `<div className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, hsl(119 84% 66% / 0.18), transparent 60%)' }} />`
- Z-index: decoração `z-0`, conteúdo `relative z-10`.

---

## Fora do escopo

- Mockup/preview do produto no hero (ficou pra fase B+C que você não escolheu agora).
- Stats bar, timeline numerada dos pillars, prova social.
- Mexer em rotas de auth, dashboard ou qualquer outra página.

---

## Validação

- Screenshot da landing em 1024 e 390 (mobile).
- Conferir que: (a) não tem mais gradient verde difuso, (b) não tem mais faixa cinza-clara, (c) grid blueprint aparece sutil sem competir com texto, (d) halo lima dá foco no H1 sem virar glow exagerado.
