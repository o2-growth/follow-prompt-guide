# Rebrand: Aplicar Design System O2 Inc. + Logos oficiais

## O que muda visualmente
- **Modo padrão vira DARK** (`#3A3A3A` de fundo, texto off-white). Light mode continua existindo mas como variante.
- **Cor de acento muda de dourado `#C9A24A` → Lima Green** (`#63F161` no dark, `#00D842` no light).
- **Tipografia**: Source Serif Pro/Inter → **Tusker Grotesk** (display, uppercase) + **Montserrat** (body) + **JetBrains Mono** (eyebrows/labels).
- **Logos placeholder em SVG inline são substituídos pelos PNGs oficiais** entregues (logo completo + ícone, versões black/white).
- Cantos: pill em botões, `12px` em cards, `20px` em cards grandes.
- Easing único: `cubic-bezier(0.2, 0.8, 0.2, 1)`.

## Co-branding O2 × G4
- A marca G4 Educação **continua aparecendo** ao lado da O2 (header, footer, auth, capa do PDF) — apenas a O2 ganha logo oficial. G4 segue como wordmark placeholder (sem asset oficial recebido). Confirmar se está OK manter assim.

## Implementação

### 1. Assets
- Copiar os 4 PNGs do logo + 4 do ícone para `src/assets/branding/`:
  - `o2-logo-black.png`, `o2-logo-white.png`
  - `o2-icon-black.png`, `o2-icon-white.png` (na verdade ambos os ícones vêm em verde — usar como icon principal)
- Baixar **Tusker Grotesk** do Drive oficial não é possível pelo agente (Drive privado). Plano: usar **Anton + Barlow Condensed** (Google Fonts) como display até o usuário subir os `.woff2` em `public/fonts/tusker-grotesk/`. O `@font-face` fica preparado para quando os arquivos chegarem.

### 2. Tokens (`src/index.css`)
Reescrever o `:root` com os tokens O2 (lima, ink, bg dark) e adicionar `[data-theme="light"]`. Atualizar `--font-sans`, `--font-serif`, `--font-mono`. Definir `data-theme="dark"` no `<html>`.

### 3. Tailwind (`tailwind.config.ts`)
- `fontFamily.display` = Tusker → Anton fallback; `fontFamily.sans` = Montserrat; `fontFamily.mono` = JetBrains Mono.
- Religar `darkMode: ["class"]` se necessário (mas tokens já fazem o trabalho via `data-theme`).

### 4. Componentes branding (`src/components/branding/`)
- `LogoO2inc.tsx`: trocar SVG inline por `<img src={variant === 'dark' ? whiteLogo : blackLogo} />` com tamanhos preservados.
- Criar `LogoO2Icon.tsx` (só o símbolo, para sidebar colapsado e favicon).
- `CoBranding.tsx`: separador `×` continua, mas em mono/lima.
- `LogoG4.tsx`: ajustar cores para usar tokens novos (lima no "4" em vez de dourado).

### 5. Index.html
- Adicionar `<link>` Google Fonts (Montserrat, JetBrains Mono, Anton, Barlow Condensed).
- Trocar favicon para o ícone O2 (`public/favicon.png` ← copy do `Icon.png`).
- Adicionar `data-theme="dark"` no `<html>`.

### 6. Páginas afetadas (visual sweep, sem mudar lógica)
- `Landing.tsx`: hero gradient passa a ser dark + lima glow; "Presente exclusivo G4 Educação" chip vira mono uppercase verde lima; títulos viram Tusker uppercase.
- `AppShell.tsx`: sidebar já é dark — apenas trocar acentos dourado→lima e logo placeholder pelo `LogoO2inc` (variant white) + `LogoO2Icon` quando colapsado.
- `auth/Login.tsx` + `Signup.tsx`: split-screen com lado esquerdo dark + lima accent.
- `ExportPDF.tsx`: paleta Navy/Gold do PDF muda para **Ink-900 + Lima 500** (PDF segue light, então usa Lima 500). Logo da capa passa a ser o PNG oficial. Datas/mono labels ganham JetBrains Mono.
- Botões: `Button` usa pill (`rounded-full`) com Lima accent.
- Cards: `border-radius` 12px, hover ganha `border-strong`.

### 7. Memory update
- Atualizar `mem://index.md` com nova paleta (lima/ink em vez de navy/gold) e fontes (Tusker/Montserrat em vez de Inter/Source Serif).

## Tópicos para confirmação
1. **Manter co-branding G4** ao lado da O2 (sim, padrão) ou remover G4 e deixar só O2?
2. **Tusker Grotesk**: você consegue subir os 3 `.woff2` em `public/fonts/tusker-grotesk/` depois? Sem isso, fica Anton (Google Fonts) que é visualmente próximo mas não idêntico.
3. **PDF**: manter em modo light (papel branco) com lima 500 como acento? Recomendado para impressão.

## Fora de escopo
- Animações `breathe` / spinning rings do hero — só se quiser depois.
- Refatoração completa de todos os componentes shadcn (mantemos os existentes, tokens novos cuidam do resto).
