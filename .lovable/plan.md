## Objetivo

Elevar o PDF a "qualidade O2": tipografia oficial da marca embedada, logos reais na capa/footer, e corrigir gaps de dados (lucro líquido bugado, top 3 ordenado errado, acentos pt-BR, fallback de visão vazia).

---

## Frente 1 — Tipografia oficial embedada

jsPDF só vem com Helvetica/Times. Precisamos embedar TTFs reais para usar a identidade O2.

### Fontes a embedar (todas Google Fonts, livres pra uso comercial)

| Papel no design | Fonte web | Fonte no PDF | Substitui |
|---|---|---|---|
| Display H1/H2/H3 (uppercase) | Tusker Grotesk | **Anton** (fallback oficial da brand memory) | `times bold` |
| Body | Montserrat | **Montserrat** (Regular 400 + Bold 700) | `helvetica` |
| Eyebrows / labels mono / números | JetBrains Mono | **JetBrains Mono** (Regular 400 + Bold 700) | charSpace hack |

### Implementação

1. Baixar TTFs uma vez via script offline e salvar em `src/assets/fonts/pdf/`:
   - `Anton-Regular.ttf`
   - `Montserrat-Regular.ttf`, `Montserrat-Bold.ttf`, `Montserrat-Italic.ttf`
   - `JetBrainsMono-Regular.ttf`, `JetBrainsMono-Bold.ttf`
2. Criar `src/lib/pdf/registerFonts.ts` que:
   - Importa cada TTF como base64 (vite `?url` + fetch + arrayBuffer→base64) ou usa `?raw`+base64 build-time.
   - Registra com `doc.addFileToVFS(...)` + `doc.addFont(...)` no início de `generate()`.
   - Expõe constantes `FONT.display`, `FONT.body`, `FONT.mono`.
3. Substituir TODAS as chamadas `doc.setFont("helvetica"...)`, `doc.setFont("times"...)` em `ExportPDF.tsx` pelas constantes (~50 ocorrências).
4. autoTable: passar `styles: { font: FONT.body }` em todas as tabelas.

### Trade-off de tamanho

6 TTFs ≈ 800KB total. Vamos importar como base64 estático no bundle. Aceitável para uma página que só carrega quando o usuário gera PDF (lazy via `React.lazy` se quiser, mas fora do escopo).

---

## Frente 2 — Logos reais na capa e footer

### Capa (página 1)
- Hoje: só texto "STRATEGIC OS / O2 Inc. x G4 Educacao".
- Mudar para:
  - Topo esquerdo: `o2-logo-white.png` (altura ~32pt) + separador "×" mono em lima + `g4-logo-white.svg` convertido pra PNG.
  - Mantém todo o resto (PLANO ESTRATEGICO, nome da empresa, metadados, data, faixa lima inferior).
- Como SVG não roda direto no jsPDF, importar PNGs já existentes. G4 tem SVG → preciso de PNG branco. Solução: usar o ícone ou converter via canvas em runtime; mais simples = adicionar um `g4-logo-white.png` em `src/assets/branding/` (gerado uma vez).

### Footer de todas as páginas
- Hoje: linha + "Strategic OS · O2 Inc. x G4 Educacao · pag N".
- Mudar para mini-logo O2 (height 10pt) + "×" + mini G4 + "Strategic OS · pag N" — em mono, lima muito sutil.

### Implementação
- `src/lib/pdf/loadImages.ts`: helper `loadImageAsDataURL(url)` (fetch + FileReader).
- Pré-carregar antes do `generate()` retornar.
- `doc.addImage(dataURL, "PNG", x, y, w, h)`.

---

## Frente 3 — Correções de dados

### 3.1 Lucro líquido = 0 (BUG)
- `dre_line_items` só persiste Receita/OPEX/EBITDA. `byYearLabel["Lucro liquido"]` retorna undefined → fmt(0) → "R$ 0".
- **Fix**: calcular em runtime:
  ```ts
  const taxRate = (proj.inputs_json?.effective_tax ?? 0.34);
  const ebitda = byYearLabel["EBITDA"]?.[i+1] ?? 0;
  const lucro = Math.round(ebitda * (1 - taxRate));
  ```
- Aplicar nos 3 cenários.

### 3.2 Top 3 prioridades quando tudo zerado
- Hoje: `sort((a,b) => a[1] - b[1]).slice(0,3)` → ordem alfabética/inserção quando empatado.
- **Fix**: ordem fixa de prioridade quando scores ≤ 20 → `["vision", "okrs", "rituals"]` (alinhado à filosofia O2: visão→meta→ritual).
- Caso scores variados, manter ordenação por menor score (lógica atual).

### 3.3 Acentos no texto fixo
Substituir tudo no `ExportPDF.tsx`:
- "Visao" → "Visão" (várias)
- "Educacao" → "Educação"
- "Cenario" → "Cenário"
- "Sumario" → "Sumário"
- "Estrategico" → "Estratégico"
- "Execucao" → "Execução"
- "Sugestoes" → "Sugestões"
- "Cadencia" → "Cadência"
- "Inteligencia" → "Inteligência"
- "Refino de norte" → "Refino de Norte"
- "acao" → "ação"
- "pag." → "Pág."
- "Operacoes" → "Operações"
- "Financas" → "Finanças"
- "Descricao" → "Descrição"
- "Projecao" → "Projeção"
- (etc — varredura completa)

Como vamos embedar TTFs Unicode, acentos rendem perfeitamente.

### 3.4 Visão vazia → mostrar sugestão da IA
- Quando `vision_plans` para horizonte X não existe **mas** `ai.sugestoes_visao` existe, renderizar com badge "Sugerido pela IA · pendente de validação" em lima/itálico em vez de "-".
- Aplicar nos 3 horizontes (5/3/1).

### 3.5 Plano 90 dias possivelmente truncado
- Investigar: se `ai.plano_90_dias` tem só 2-3 itens, o problema é na geração (edge function `generate-action-plan`) e está fora do escopo desta task.
- Se tem 6 e o PDF está cortando: revisar `ensureSpace` para garantir que cada bloco respeita altura.
- Vou só conferir; se for truncamento de IA, abro como follow-up.

---

## Detalhes técnicos

- Não tocar em rotas, auth, edge functions, banco.
- Manter `clean()` pra emojis, mas remover replace de aspas/travessões (Anton/Montserrat suportam).
- Fontes carregadas **uma vez** no início de `generate()` e cacheadas em module-level Map.
- TypeScript: declarar `declare module "*.ttf?url"` se necessário em `vite-env.d.ts`.

## Validação

1. Gerar PDF de um workspace com dados reais.
2. Conferir visualmente:
   - Capa com 2 logos no topo, fonte Anton no nome do tenant.
   - Body em Montserrat (não Helvetica chapado).
   - Eyebrows em JetBrains Mono.
   - Footer com mini-logos.
   - Lucro líquido ≠ R$ 0 (deve ser EBITDA × 0.66).
   - Acentos corretos em todos os títulos hardcoded.
3. QA com `pdftoppm -jpeg -r 150` + inspeção página a página.

## Fora do escopo

- Embedar Tusker Grotesk real (arquivos não chegaram ainda — fica pra quando subirem em `public/fonts/tusker-grotesk/`).
- Mexer na geração da IA (edge function `generate-action-plan`).
- Adicionar página nova ou seção nova.
- Refatorar para `react-pdf` ou `@react-pdf/renderer` — manter jsPDF.
