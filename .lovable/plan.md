# Fix de contraste/legibilidade O2 dark + reverter logo G4

## Causa raiz
Em `src/index.css`, no dark mode redefini `--primary: 0 0% 13%` (Ink-900). Como todos os títulos das páginas usam `text-primary` (padrão herdado do tema light antigo), os títulos viraram quase-preto sobre o fundo `#3A3A3A` — invisíveis. Mesmo problema em `bg-primary` (botões default do shadcn ficam ink-on-ink).

## Mudanças

### 1. `src/index.css` — recalibrar tokens dark

- `--primary: 0 0% 98%` (off-white). Agora `text-primary` nos títulos = branco brilhante, legível.
- `--primary-foreground: 0 0% 13%` (Ink-900). Botões `bg-primary` viram pílulas brancas com texto escuro (estilo secundário aceitável).
- `--card: 0 0% 14%` (Ink elev-2 `#252525`, mais escuro que o bg `#3A3A3A`) → cards passam a ser **mais escuros** que o fundo, com hierarquia clara em vez de "quase a mesma cor".
- `--popover: 0 0% 11%`.
- `--secondary: 0 0% 26%`, `--secondary-foreground: 0 0% 98%`.
- `--muted: 0 0% 18%`, `--muted-foreground: 0 0% 70%` (era 77% — pouco contraste; subir leve).
- `--input: 0 0% 18%` (mesmo que muted) — campos passam a ser **mais escuros** que o card, e não mais claros.
- `--border: 0 0% 100%` mantém, mas aumentar opacidade nos componentes que usam só `border-border` (border default do shadcn aplica alpha 10%; subir a aparência via `border-strong` em cards).
- Manter `--accent: 119 84% 66%` (lima 400) — único acento da marca.

### 2. `src/components/ui/card.tsx`
Adicionar `border border-white/10` por padrão e `shadow-soft` para destacar cards do fundo.

### 3. `src/components/ui/button.tsx`
Mudar a variant `default` para usar `bg-accent text-accent-foreground hover:bg-accent/90` (lima). Botões de ação ficam lima — alinhado à identidade O2 (CTA = lima sempre). A variant `secondary` fica como botão branco/ink.

### 4. `src/components/branding/LogoG4.tsx` — REVERTER
Voltar `fill = navy hsl(217 70% 14%)` no light e off-white no dark; `accent = dourado hsl(42 50% 54%)`. **Logo G4 não é nossa para mudar.**

### 5. `src/components/common/EmptyState.tsx`
Trocar `border-dashed border-border` (invisível) por `border-dashed border-white/15`.

### 6. `src/index.css` — gradient-hero mais rico
Atual: cinzas chapados. Trocar para gradiente que tenha um respiro de lima (auth split-screen ficou monótono):
```css
--gradient-hero: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 45%, #1f3a25 100%);
```
E adicionar glow lima discreto via `box-shadow` nos blocos hero.

### 7. Auditoria pontual de páginas (sem mudar lógica)
- `src/pages/Onboarding.tsx`: o wrapper `bg-background` + card sem borda fica chapado. Adicionar `border border-white/10 shadow-elegant` no card principal.
- `src/pages/Landing.tsx`: o chip "Presente exclusivo" usa `bg-accent/15 border-accent/30` — OK, mas confirmar contraste do CTA primário (já é `bg-accent`).

### 8. Tokens semânticos a verificar (varrer)
Nenhuma cor hardcoded (`text-white`, `bg-black`, `#xxx`) deve estar em componentes — checar com `rg` e remover se houver.

## Resultado esperado
- Títulos de página voltam a aparecer **brancos brilhantes** sobre o dark.
- Cards têm hierarquia visível (mais escuros que o fundo + borda branca 10%).
- Inputs ficam **dentro** do card, não mais brilhantes que ele.
- Botões de ação primária ficam **lima** (identidade O2), botões neutros ficam brancos/ink.
- Logo G4 volta ao dourado original.

## Fora de escopo
Refatorar todos os `text-primary` página por página — a recalibração do token resolve sem tocar nas páginas.
