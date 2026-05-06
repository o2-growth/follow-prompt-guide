## Substituir placeholder do G4 pela logo oficial

Você enviou a logo oficial **G4 Educação** (versão branca completa, SVG vetorial). Vou trocar o placeholder atual pelo asset real, mantendo a API do componente intacta para não quebrar nenhum uso (Landing, AppShell, Login split-screen, PDF, CoBranding).

### O que vou fazer

1. **Salvar o SVG oficial** em `src/assets/branding/g4-logo-white.svg` (versão branca, ideal para fundo escuro = nosso tema padrão).
2. **Reescrever `src/components/branding/LogoG4.tsx`** para renderizar a logo real:
   - `variant="dark"` (fundo escuro): usa o SVG branco diretamente.
   - `variant="light"` (fundo claro, ex.: capa do PDF): aplica `filter: invert(1)` ou usa CSS `currentColor` para escurecer — verifico no preview qual fica melhor.
   - Mantém props `size` (sm/md/lg) ajustando width/height proporcional ao aspect ratio original (101×40).
   - Mantém `className`, `title` (acessibilidade).
3. **Não tocar em nada mais.** `CoBranding`, `LogoO2inc`, AppShell, Landing e Login continuam funcionando porque a interface pública do componente é preservada.

### Pergunta antes de implementar

Você só me mandou a versão **branca**. Você tem também a versão **preta/colorida** da logo G4 para usar em fundos claros (capa do PDF exportado, por exemplo)? 

- **Se sim**, me envia que eu salvo as duas variantes.
- **Se não**, eu uso a versão branca em ambos os casos e aplico um filtro CSS (`filter: invert(1) brightness(0)`) na variante `light` para ficar preta — funciona bem com SVG monocromático, mas perde fidelidade se a logo oficial tiver cores específicas pro fundo claro.

Confirma para eu implementar?
