# Branding components

Componentes de identidade visual co-branded **O2inc × G4 Educação**.

## Arquivos

- `LogoO2inc.tsx` — wordmark "O2inc" (placeholder atual: SVG inline com Source Serif Pro bold + superscript "®").
- `LogoG4.tsx` — wordmark "G4 Educação" (placeholder atual: SVG inline com Inter Black para "G4" + Inter Medium para "EDUCAÇÃO").
- `CoBranding.tsx` — composição lado-a-lado dos dois com separador "×".

## API comum

```tsx
type Size = "sm" | "md" | "lg";
type Variant = "light" | "dark"; // light = sobre fundo claro; dark = sobre fundo navy
```

Todos aceitam `className` para overrides de spacing.

## Substituindo placeholders pelos logos oficiais

Quando o CEO (Pedro Albite) entregar os assets oficiais:

1. **Formato preferido:** SVG (vetorial, escalável, leve). Otimizar via [SVGOMG](https://jakearchibald.github.io/svgomg/) antes de subir.
2. **Fallback aceitável:** PNG @2x / @3x ou WebP (somente se SVG não estiver disponível).
3. **Como trocar:** edite `LogoO2inc.tsx` e/ou `LogoG4.tsx` substituindo o conteúdo do `<svg>` ou trocando por `<img src=… />`. **Mantenha as props `size` / `variant` / `className`** para que os usos em Landing, AppShell, auth pages e PDF continuem funcionando sem refactor.
4. Se o logo oficial vier como arquivo, salve em `public/branding/` (ex.: `public/branding/o2inc.svg`) e referencie via `<img src="/branding/o2inc.svg" />`.

## Onde estão usados

- `src/pages/Landing.tsx` — header e footer.
- `src/components/layout/AppShell.tsx` — sidebar header.
- `src/pages/auth/Login.tsx` (componente `AuthLayout`) — split-screen header (também alimenta `Signup.tsx`).
- (Futuro) `src/pages/ExportPDF.tsx` — capa do PDF. Por ora, o módulo PDF é responsabilidade do agente Dex; recomendação: usar `<CoBranding />` no preview e gerar versão raster via `html-to-canvas` ou referenciar o SVG diretamente no `jsPDF`.
