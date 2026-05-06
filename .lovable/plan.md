## Objetivo

Polir a landing em mobile (390px). Hoje em telas pequenas:
- Header está apertado (logo + "Entrar" + "Criar conta" competindo por largura).
- H1 em Tusker uppercase com `text-4xl` (~36px) corre risco de "estourar" — `EXECUTÁVEL` é palavra longa.
- Padding lateral do `container` é `2rem` (32px) — come muito espaço útil em 390px.
- CTAs ficam empilhados mas com largura intrínseca, não full-width — visual inconsistente.
- Checklist (`gap-6 flex-wrap`) quebra em 2 linhas com espaçamento esquisito.
- Pillar cards com `p-8` ficam apertados.
- Footer com muito conteúdo centralizado vira parede de texto.

---

## Mudanças (todas em `src/pages/Landing.tsx` + ajuste mínimo no container)

### 1. `tailwind.config.ts` — container padding responsivo

```ts
container: {
  center: true,
  padding: { DEFAULT: "1.25rem", sm: "1.5rem", lg: "2rem" },
  screens: { "2xl": "1400px" },
}
```
Em mobile cai de 32px → 20px de padding, ganhando 24px de largura útil.

### 2. Header

- Esconder texto "Entrar" em mobile, deixar só o botão "Criar conta" (CTA principal). Login fica acessível via "Já tenho conta" no hero.
- Alternativa mais segura: trocar "Entrar" por ghost menor `text-xs` e "Criar conta" mantém destaque.
- Logo `CoBranding size="sm"` já é mínimo; ok.

### 3. Hero

- H1: `text-3xl sm:text-4xl md:text-6xl` (começa menor em mobile).
- Parágrafo: `text-base md:text-xl` (16px em mobile, não 18px).
- Padding vertical: `py-14 md:py-28` (menos respiro em mobile).
- Botões: adicionar `w-full sm:w-auto` para virarem full-width empilhados em mobile (padrão moderno e mais clicável).
- Checklist: trocar `flex-wrap gap-6` por `flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-6` — empilha vertical em mobile.
- Halo lima e grid: ajustar tamanho do halo para não vazar (em mobile, `h-[400px] w-[400px]` é suficiente).

### 4. Pillars

- Cards: `p-6 md:p-8` (menos padding em mobile).
- Section: `py-14 md:py-28`.

### 5. PDF callout

- `py-14 md:py-20`.
- H2 já é responsivo (`text-3xl md:text-4xl`), ok.
- Botão: `w-full sm:w-auto`.

### 6. Footer

- Hoje empilha mas com `text-center` confuso. Simplificar:
  - Remover separadores `·` invisíveis em mobile.
  - Stack vertical com `text-center`, `gap-3`.
  - Linha "Bônus exclusivo · G4 Tools · Pedro Albite" pode quebrar em 2 linhas com `text-xs` em mobile.

---

## Detalhes técnicos

- Não tocar em rotas, lógica, auth ou outras páginas.
- Não criar novos componentes.
- Apenas classes Tailwind responsivas e ajuste do container no config.

## Validação

- Screenshot em 390x808 antes/depois.
- Conferir: H1 não estoura, CTAs ocupam largura cheia, checklist empilha limpo, header não cobre botões, padding lateral confortável.
