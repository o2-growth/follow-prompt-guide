# Trocar "Palestra G4 Educação" pela logo G4 Tools

## Objetivo
Substituir as menções textuais a "Palestra G4 Educação" pela **logo G4 Tools** (PNG com fundo removido) no rodapé da landing, na tela de login e nos termos.

## Passos

1. **Preparar a imagem da logo**
   - Copiar `user-uploads://626214124_18092907791294580_7243772065179250383_n.jpg` para `src/assets/branding/g4-tools-source.jpg`.
   - Usar `imagegen--edit_image` para remover o fundo bege e gerar `src/assets/branding/g4-tools-logo.png` com fundo transparente, mantendo o ícone da bússola + wordmark "G4 TOOLS" originais.

2. **Criar componente `LogoG4Tools`**
   - Novo arquivo `src/components/branding/LogoG4Tools.tsx`.
   - Recebe `size` ("sm" | "md") e `className`.
   - Renderiza `<img>` com a PNG transparente, `alt="G4 Tools"`, altura fixa (~16–20px no rodapé, ~20–24px no login).
   - Para uso em fundo escuro: aplicar `filter: invert(1) brightness(1.1)` via classe utilitária para garantir contraste (a logo original é azul-marinho sobre bege).

3. **Atualizar referências**
   - `src/pages/Landing.tsx` linha 123: substituir o `<span>Bônus exclusivo · Palestra G4 Educação · Pedro Albite, CEO O2inc</span>` por uma composição: texto "Bônus exclusivo" + `<LogoG4Tools />` + "Pedro Albite, CEO O2inc", separados por bullets.
   - `src/pages/Landing.tsx` linha 46: trocar "Presente exclusivo G4 Educação" por "Presente exclusivo" + logo G4 Tools inline (mesma altura do texto, alinhada vertical).
   - `src/pages/auth/Login.tsx` linha 29: trocar "Presente exclusivo · Palestra G4 Educação" por "Presente exclusivo" + `<LogoG4Tools />`.
   - `src/pages/legal/Terms.tsx` linha 25: trocar "palestra G4 Educação" por "G4 Tools" (texto puro, dentro de parágrafo legal — logo seria estranha aqui).

4. **Memória**
   - Atualizar `mem://index.md`: trocar "O2 Inc. × G4 Educação" por "O2 Inc. × G4 Tools" e remover a nota sobre placeholder G4.

## Fora de escopo
- Não trocar o `LogoG4` existente no header (co-branding "O2 × G4 Educação") — só as menções a "Palestra G4 Educação" no rodapé/login/termos.
- Se você quiser também atualizar o header co-branded, me avise e eu incluo.
