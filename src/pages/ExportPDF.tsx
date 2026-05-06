import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileDown, Loader2 } from "lucide-react";
import { useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { captureError } from "@/lib/sentry";

const DIM_LABEL: Record<string, string> = {
  vision: "Visão",
  okrs: "OKRs",
  rituals: "Rituais",
  team: "Time",
  financial: "Financeiro",
};

const REVENUE_BAND_TO_KEY = (band?: string | null): "<5M" | "5-20M" | ">20M" => {
  if (!band) return "<5M";
  if (band.includes("Acima") || band.includes("50M") || band.includes("200M")) return ">20M";
  if (band.includes("10M")) return "5-20M";
  return "<5M";
};

const FRAMEWORK_RECOMMENDATIONS_BY_DIM: Record<string, string[]> = {
  vision: ["OKR"],
  okrs: ["OKR", "RACI"],
  rituals: ["RACI", "Eisenhower"],
  team: ["RACI", "MEDDIC"],
  financial: ["RACI", "Eisenhower"],
};

export default function ExportPDF() {
  const { data: m } = useTenant();
  const tenantId = m?.tenant_id;
  const [generating, setGenerating] = useState(false);

  const { data: bundle } = useQuery({
    queryKey: ["export-bundle", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const [vision, objectives, maturity, rituals, projections, dre, roleTemplates, frameworks, aiPlan] = await Promise.all([
        supabase.from("vision_plans").select("*").eq("tenant_id", tenantId!),
        supabase.from("okrs_objectives").select("*, key_results(*)").eq("tenant_id", tenantId!),
        supabase.from("maturity_assessments").select("*").eq("tenant_id", tenantId!).order("taken_at", { ascending: false }),
        supabase.from("rituals").select("*").eq("tenant_id", tenantId!).eq("active", true),
        supabase.from("financial_projections").select("*").eq("tenant_id", tenantId!),
        supabase.from("dre_line_items").select("*").eq("tenant_id", tenantId!),
        supabase.from("role_templates").select("*"),
        (supabase.from as any)("framework_library").select("*").order("display_order"),
        (supabase.from as any)("ai_action_plans").select("*").eq("tenant_id", tenantId!).eq("status", "ready").order("generated_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      const latestMaturity: Record<string, number> = {};
      (maturity.data ?? []).forEach(a => {
        if (latestMaturity[a.dimension] === undefined) latestMaturity[a.dimension] = a.score;
      });
      return {
        vision: vision.data ?? [],
        objectives: objectives.data ?? [],
        maturity: latestMaturity,
        rituals: rituals.data ?? [],
        projections: projections.data ?? [],
        dre: dre.data ?? [],
        roleTemplates: roleTemplates.data ?? [],
        frameworks: (frameworks?.data as any[]) ?? [],
        aiPlan: (aiPlan?.data as any) ?? null,
      };
    },
  });

  const regenerateAi = async () => {
    if (!tenantId) return;
    try {
      toast.loading("Gerando plano de ação com IA…", { id: "ai-plan" });
      const { error } = await supabase.functions.invoke("generate-action-plan", { body: { tenant_id: tenantId } });
      toast.dismiss("ai-plan");
      if (error) throw error;
      toast.success("Plano de ação gerado!");
      window.location.reload();
    } catch (e: any) {
      toast.dismiss("ai-plan");
      toast.error(e?.message ?? "Erro ao gerar plano de IA");
    }
  };

  const generate = async () => {
    if (!bundle || !m) return;
    setGenerating(true);
    try {
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const W = doc.internal.pageSize.getWidth();
      const H = doc.internal.pageSize.getHeight();
      const tenant = ((m as any).tenants as any) ?? {};
      const today = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

      // O2 Inc. palette (PDF é light/papel)
      const NAVY: [number, number, number] = [33, 33, 33];      // Ink-900
      const NAVY_SOFT: [number, number, number] = [73, 73, 73]; // Ink-700
      const GOLD: [number, number, number] = [0, 216, 66];      // Lima 500
      const GREEN: [number, number, number] = [0, 176, 56];     // Lima 600
      const INK: [number, number, number] = [33, 33, 33];
      const MUTED: [number, number, number] = [103, 103, 103];  // Ink-500
      const BG: [number, number, number] = [251, 251, 250];     // Off-white
      const LINE: [number, number, number] = [234, 234, 234];   // Ink-150

      const MARGIN = 50;
      const CONTENT_W = W - MARGIN * 2;

      const fmt = (n: number) =>
        n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

      // Sanitiza strings: remove emojis/glyphs não suportados pelas fontes core do jsPDF
      const clean = (s: any): string => {
        if (s === null || s === undefined) return "";
        return String(s)
          // Remove emojis e símbolos pictográficos
          .replace(/[\u{1F300}-\u{1FAFF}]/gu, "")
          .replace(/[\u{2600}-\u{27BF}]/gu, "")
          .replace(/[\u{2300}-\u{23FF}]/gu, "")
          .replace(/[\u{2B00}-\u{2BFF}]/gu, "")
          // Substitui aspas/travessões "inteligentes"
          .replace(/[\u2018\u2019]/g, "'")
          .replace(/[\u201C\u201D]/g, '"')
          .replace(/[\u2013\u2014]/g, "-")
          .replace(/\u2026/g, "...")
          .replace(/\u00A0/g, " ")
          .trim();
      };

      let page = 1;
      const footer = () => {
        doc.setDrawColor(...LINE); doc.setLineWidth(0.5);
        doc.line(MARGIN, H - 36, W - MARGIN, H - 36);
        doc.setFontSize(8); doc.setTextColor(...MUTED); doc.setFont("helvetica", "normal");
        doc.text("Strategic OS  ·  O2 Inc. x G4 Educacao", MARGIN, H - 22);
        doc.text(`pag. ${page}`, W - MARGIN, H - 22, { align: "right" });
      };

      const addPage = () => { footer(); doc.addPage(); page++; };

      // Header padrão de seção (cabeçalho navy fino)
      const sectionHeader = (eyebrow: string, title: string) => {
        doc.setFillColor(...NAVY); doc.rect(0, 0, W, 90, "F");
        doc.setFillColor(...GOLD); doc.rect(0, 90, W, 3, "F");
        doc.setTextColor(...GOLD); doc.setFontSize(9); doc.setFont("helvetica", "bold");
        doc.text(clean(eyebrow).toUpperCase(), MARGIN, 38, { charSpace: 1.2 });
        doc.setTextColor(255); doc.setFont("times", "bold"); doc.setFontSize(24);
        doc.text(clean(title), MARGIN, 70);
      };

      // Bloco de texto com quebra. Retorna y final.
      const writeLines = (text: string, x: number, y: number, maxWidth: number, lineHeight = 14) => {
        const lines = doc.splitTextToSize(clean(text), maxWidth);
        doc.text(lines, x, y);
        return y + lines.length * lineHeight;
      };

      // bullet desenhado (círculo dourado)
      const bullet = (x: number, y: number, color: [number, number, number] = GOLD) => {
        doc.setFillColor(...color); doc.circle(x, y - 3, 1.8, "F");
      };

      const ensureSpace = (need: number, contTitle?: string) => {
        if (y > H - need) {
          addPage();
          if (contTitle) sectionHeader("continuacao", contTitle);
          y = contTitle ? 130 : 80;
        }
      };

      let y = 0;

      // ==================== CAPA ====================
      doc.setFillColor(...NAVY); doc.rect(0, 0, W, H, "F");
      // Detalhes decorativos
      doc.setFillColor(...GOLD); doc.rect(0, H - 8, W, 8, "F");
      doc.setFillColor(...GOLD); doc.rect(MARGIN, 100, 40, 3, "F");

      doc.setTextColor(...GOLD); doc.setFontSize(10); doc.setFont("helvetica", "bold");
      doc.text("STRATEGIC OS", MARGIN, 70, { charSpace: 2 });
      doc.setTextColor(220); doc.setFont("helvetica", "normal"); doc.setFontSize(9);
      doc.text("O2 Inc.  x  G4 Educacao", MARGIN, 86);

      doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(...GOLD);
      doc.text("PLANO ESTRATEGICO", MARGIN, 130, { charSpace: 2 });

      doc.setFont("times", "bold"); doc.setFontSize(48); doc.setTextColor(255);
      const nameLines = doc.splitTextToSize(clean(tenant.name ?? "Workspace"), W - MARGIN * 2);
      doc.text(nameLines, MARGIN, H / 2 - 20);

      // Bloco de metadados
      doc.setDrawColor(...GOLD); doc.setLineWidth(0.5);
      doc.line(MARGIN, H - 180, MARGIN + 60, H - 180);
      doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(220);
      let cy = H - 160;
      if (tenant.sector) { doc.text(`Setor:  ${clean(tenant.sector)}`, MARGIN, cy); cy += 16; }
      if (tenant.size_band) { doc.text(`Porte:  ${clean(tenant.size_band)} colaboradores`, MARGIN, cy); cy += 16; }
      if (tenant.cnpj) { doc.text(`CNPJ:  ${clean(tenant.cnpj)}`, MARGIN, cy); cy += 16; }
      doc.setTextColor(...GOLD); doc.text(today.toUpperCase(), MARGIN, H - 50);
      doc.addPage(); page++;

      // ==================== SUMÁRIO EXECUTIVO ====================
      sectionHeader("01  ·  Visao geral", "Sumario executivo");
      y = 130;

      const matValues = Object.values(bundle.maturity);
      const overall = matValues.length ? Math.round(matValues.reduce((a, b) => a + b, 0) / matValues.length) : 0;

      // Card de score grande
      doc.setFillColor(...BG); doc.roundedRect(MARGIN, y, CONTENT_W, 90, 8, 8, "F");
      doc.setTextColor(...MUTED); doc.setFont("helvetica", "normal"); doc.setFontSize(9);
      doc.text("SCORE DE MATURIDADE GERAL", MARGIN + 24, y + 28, { charSpace: 1.5 });
      doc.setTextColor(...NAVY); doc.setFont("times", "bold"); doc.setFontSize(48);
      doc.text(`${overall}`, MARGIN + 24, y + 72);
      doc.setFont("helvetica", "normal"); doc.setFontSize(14); doc.setTextColor(...MUTED);
      doc.text("/100", MARGIN + 24 + doc.getTextWidth(`${overall}`) + 6, y + 72);

      // Mini barras por dimensão à direita
      const dims = Object.entries(bundle.maturity);
      if (dims.length) {
        const barX = MARGIN + 220;
        const barW = CONTENT_W - 240;
        const rowH = 14;
        const totalH = dims.length * rowH;
        let by = y + (90 - totalH) / 2 + 8;
        dims.forEach(([k, v]) => {
          doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...INK);
          doc.text(clean(DIM_LABEL[k] ?? k), barX, by);
          doc.setFillColor(...LINE); doc.roundedRect(barX + 70, by - 7, barW - 110, 7, 2, 2, "F");
          const fill = Math.max(2, ((v as number) / 100) * (barW - 110));
          doc.setFillColor(...GOLD); doc.roundedRect(barX + 70, by - 7, fill, 7, 2, 2, "F");
          doc.setFontSize(8); doc.setTextColor(...MUTED);
          doc.text(`${v}/100`, barX + barW - 30, by);
          by += rowH;
        });
      }
      y += 110;

      // Top prioridades
      doc.setFont("times", "bold"); doc.setFontSize(14); doc.setTextColor(...NAVY);
      doc.text("Top 3 prioridades estrategicas", MARGIN, y); y += 6;
      doc.setDrawColor(...GOLD); doc.setLineWidth(1.2); doc.line(MARGIN, y, MARGIN + 30, y); y += 18;

      doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...INK);
      const top3 = Object.entries(bundle.maturity).sort((a, b) => a[1] - b[1]).slice(0, 3);
      const recommendedFrameworkKeys = new Set<string>();
      const priorityNames: Record<string, string> = {
        vision: "Fortalecer visao e cascata estrategica",
        okrs: "Implantar ciclo de OKRs trimestrais",
        rituals: "Estabelecer rituais de gestao",
        team: "Estruturar organograma e responsabilidades",
        financial: "Construir DRE projetado e cenarios",
      };
      top3.forEach(([k], i) => {
        bullet(MARGIN + 6, y, GOLD);
        doc.setFont("helvetica", "bold"); doc.setTextColor(...NAVY);
        doc.text(`0${i + 1}`, MARGIN + 14, y);
        doc.setFont("helvetica", "normal"); doc.setTextColor(...INK);
        doc.text(clean(priorityNames[k] ?? k), MARGIN + 36, y);
        y += 18;
        (FRAMEWORK_RECOMMENDATIONS_BY_DIM[k] ?? []).forEach(fk => recommendedFrameworkKeys.add(fk));
      });

      y += 14;
      doc.setFont("times", "bold"); doc.setFontSize(14); doc.setTextColor(...NAVY);
      doc.text("Frameworks recomendados", MARGIN, y); y += 6;
      doc.setDrawColor(...GOLD); doc.line(MARGIN, y, MARGIN + 30, y); y += 18;

      const recFrameworks = (bundle.frameworks as any[])
        .filter(f => recommendedFrameworkKeys.has(f.key))
        .slice(0, 3);
      const fallbackFw = [
        { name: "OKR", when_to_apply: "Sistema trimestral de objetivos e resultados-chave." },
        { name: "RACI", when_to_apply: "Clareza de papeis em processos criticos." },
        { name: "Eisenhower", when_to_apply: "Priorizacao executiva diaria." },
      ];
      const fwToShow = recFrameworks.length ? recFrameworks : fallbackFw;
      doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...INK);
      fwToShow.forEach((f: any) => {
        bullet(MARGIN + 6, y);
        doc.setFont("helvetica", "bold"); doc.text(clean(f.name), MARGIN + 14, y);
        doc.setFont("helvetica", "normal"); doc.setTextColor(...MUTED);
        const txt = clean(f.when_to_apply ?? "");
        const wrapped = doc.splitTextToSize(txt, CONTENT_W - 100);
        doc.text(wrapped[0] ?? "", MARGIN + 80, y);
        doc.setTextColor(...INK);
        y += 18;
      });

      addPage();

      // ==================== VISÃO ESTRATÉGICA ====================
      sectionHeader("02  ·  Norte estrategico", "Visao 5 / 3 / 1 ano");
      y = 130;
      doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...MUTED);
      y = writeLines("A visao em tres horizontes orienta decisoes do dia a dia, garantindo que cada acao construa o futuro desejado.", MARGIN, y, CONTENT_W);
      y += 14;

      [5, 3, 1].forEach(h => {
        const p = bundle.vision.find(v => v.year_horizon === h) as any;
        ensureSpace(140, "Visao 5 / 3 / 1 ano");
        // card
        doc.setFillColor(...BG); doc.roundedRect(MARGIN, y, CONTENT_W, 120, 6, 6, "F");
        doc.setFillColor(...GOLD); doc.rect(MARGIN, y, 4, 120, "F");
        doc.setFont("times", "bold"); doc.setFontSize(18); doc.setTextColor(...NAVY);
        doc.text(`${h} ${h > 1 ? "anos" : "ano"}`, MARGIN + 20, y + 26);
        doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...INK);
        let cy = y + 50;
        const renderField = (label: string, val: string) => {
          doc.setFont("helvetica", "bold"); doc.setTextColor(...MUTED); doc.setFontSize(8);
          doc.text(label.toUpperCase(), MARGIN + 20, cy, { charSpace: 1 });
          doc.setFont("helvetica", "normal"); doc.setTextColor(...INK); doc.setFontSize(10);
          cy = writeLines(val || "-", MARGIN + 20, cy + 12, CONTENT_W - 40);
          cy += 6;
        };
        renderField("North Star", clean(p?.north_star));
        renderField("Missao", clean(p?.mission));
        const values = Array.isArray(p?.values_json) ? p.values_json : [];
        if (values.length) renderField("Valores", values.map(clean).join(" · "));
        y += Math.max(130, cy - y + 10);
      });

      addPage();

      // ==================== OKRs ====================
      sectionHeader("03  ·  Execucao", "OKRs vigentes");
      y = 130;
      if (!bundle.objectives.length) {
        doc.setFont("helvetica", "italic"); doc.setFontSize(10); doc.setTextColor(...MUTED);
        doc.text("Nenhum OKR cadastrado ainda.", MARGIN, y);
      } else {
        bundle.objectives.forEach((o: any) => {
          ensureSpace(80, "OKRs vigentes");
          // card objetivo
          doc.setFillColor(...NAVY); doc.roundedRect(MARGIN, y, CONTENT_W, 28, 4, 4, "F");
          doc.setFont("helvetica", "bold"); doc.setTextColor(255); doc.setFontSize(11);
          doc.text(clean(o.title), MARGIN + 14, y + 18);
          if (o.quarter) {
            doc.setFont("helvetica", "normal"); doc.setTextColor(...GOLD); doc.setFontSize(9);
            doc.text(clean(o.quarter), W - MARGIN - 14, y + 18, { align: "right" });
          }
          y += 36;

          const krs = (o.key_results ?? []) as any[];
          if (krs.length) {
            const rows = krs.map(kr => {
              const pct = kr.target ? Math.round(((kr.current ?? 0) / kr.target) * 100) : 0;
              return [clean(kr.title), `${kr.current ?? 0} / ${kr.target ?? 0}`, `${pct}%`];
            });
            autoTable(doc, {
              startY: y,
              head: [["Key Result", "Progresso", "%"]],
              body: rows,
              margin: { left: MARGIN, right: MARGIN },
              theme: "grid",
              styles: { font: "helvetica", fontSize: 9, cellPadding: 6, textColor: INK, lineColor: LINE },
              headStyles: { fillColor: BG, textColor: NAVY, fontStyle: "bold", lineColor: LINE },
              columnStyles: { 1: { halign: "right", cellWidth: 90 }, 2: { halign: "right", cellWidth: 50 } },
            });
            y = (doc as any).lastAutoTable.finalY + 14;
          }
        });
      }
      addPage();

      // ==================== PROJEÇÃO FINANCEIRA ====================
      const SCENARIO_LABELS: Record<string, string> = {
        optimistic: "Otimista",
        realistic: "Realista",
        pessimistic: "Pessimista",
      };
      const HORIZON = 5;
      for (const scenarioKey of ["optimistic", "realistic", "pessimistic"] as const) {
        sectionHeader(`04  ·  Cenario ${SCENARIO_LABELS[scenarioKey].toLowerCase()}`, `Projecao financeira ${HORIZON} anos`);
        y = 130;
        const proj = (bundle.projections as any[]).find(p => p.scenario === scenarioKey && p.horizon_years === HORIZON);
        const dreRows = (bundle.dre as any[]).filter(d => proj && d.projection_id === proj.id);

        if (!proj || dreRows.length === 0) {
          doc.setFont("helvetica", "italic"); doc.setFontSize(10); doc.setTextColor(...MUTED);
          doc.text("Nenhuma projecao persistida ainda. Acesse Financeiro e ajuste as premissas.", MARGIN, y);
        } else {
          const ij = (proj.inputs_json as any) ?? {};
          const baseInputs = ij.base_inputs ?? {};

          // Premissas em grid 2x2
          doc.setFont("times", "bold"); doc.setFontSize(13); doc.setTextColor(...NAVY);
          doc.text("Premissas", MARGIN, y); y += 6;
          doc.setDrawColor(...GOLD); doc.line(MARGIN, y, MARGIN + 30, y); y += 14;

          const premissas: [string, string][] = [
            ["Receita base", fmt(Number(baseInputs.revenue ?? ij.revenue_year1 ?? 0))],
            ["Crescimento anual", `${baseInputs.growth ?? Math.round((ij.growth_rate ?? 0) * 100)}%  x  ${(ij.scenario_multiplier ?? 1).toFixed(2)}`],
            ["Margem EBITDA", `${baseInputs.margin ?? Math.round((ij.ebitda_margin ?? 0) * 100)}%`],
            ["Imposto efetivo", `${baseInputs.tax ?? Math.round((ij.effective_tax ?? 0) * 100)}%`],
          ];
          const cardW = (CONTENT_W - 12) / 2;
          premissas.forEach((p, i) => {
            const cx = MARGIN + (i % 2) * (cardW + 12);
            const cy = y + Math.floor(i / 2) * 56;
            doc.setFillColor(...BG); doc.roundedRect(cx, cy, cardW, 48, 4, 4, "F");
            doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...MUTED);
            doc.text(p[0].toUpperCase(), cx + 12, cy + 16, { charSpace: 1 });
            doc.setFont("times", "bold"); doc.setFontSize(15); doc.setTextColor(...NAVY);
            doc.text(p[1], cx + 12, cy + 36);
          });
          y += 120;

          // DRE projetado
          doc.setFont("times", "bold"); doc.setFontSize(13); doc.setTextColor(...NAVY);
          doc.text("DRE projetado", MARGIN, y); y += 6;
          doc.setDrawColor(...GOLD); doc.line(MARGIN, y, MARGIN + 30, y); y += 8;

          const labels = ["Receita", "OPEX", "EBITDA", "Lucro liquido"];
          const byYearLabel: Record<string, Record<number, number>> = {};
          for (const r of dreRows) {
            byYearLabel[r.label] = byYearLabel[r.label] ?? {};
            byYearLabel[r.label][r.year] = Number(r.amount);
          }
          const head = ["Linha", ...Array.from({ length: HORIZON }, (_, i) => `Ano ${i + 1}`)];
          const body = labels.map(label => [
            label,
            ...Array.from({ length: HORIZON }, (_, i) => fmt(byYearLabel[label]?.[i + 1] ?? 0)),
          ]);
          autoTable(doc, {
            startY: y + 6,
            head: [head],
            body,
            margin: { left: MARGIN, right: MARGIN },
            theme: "striped",
            styles: { font: "helvetica", fontSize: 9, cellPadding: 7, textColor: INK, lineColor: LINE },
            headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold" },
            alternateRowStyles: { fillColor: BG },
            columnStyles: {
              0: { fontStyle: "bold", textColor: NAVY },
              1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" },
              4: { halign: "right" }, 5: { halign: "right" },
            },
            didParseCell: (data) => {
              if (data.row.index === 3 && data.section === "body") {
                data.cell.styles.fillColor = [232, 240, 232] as any;
                data.cell.styles.fontStyle = "bold";
              }
            },
          });
          y = (doc as any).lastAutoTable.finalY + 16;

          // Mini gráfico de barras de receita
          const receitaRow = labels.map(l => byYearLabel[l]).find(_ => true);
          const receita = byYearLabel["Receita"];
          if (receita) {
            ensureSpace(150, `Projecao financeira ${HORIZON} anos`);
            doc.setFont("times", "bold"); doc.setFontSize(13); doc.setTextColor(...NAVY);
            doc.text("Evolucao de receita", MARGIN, y); y += 6;
            doc.setDrawColor(...GOLD); doc.line(MARGIN, y, MARGIN + 30, y); y += 18;

            const chartH = 110;
            const chartW = CONTENT_W;
            const cx0 = MARGIN, cy0 = y;
            const max = Math.max(...Object.values(receita));
            const colW = (chartW - 40) / HORIZON;
            // baseline
            doc.setDrawColor(...LINE); doc.line(cx0 + 30, cy0 + chartH, cx0 + chartW, cy0 + chartH);
            for (let i = 1; i <= HORIZON; i++) {
              const v = receita[i] ?? 0;
              const h = max > 0 ? (v / max) * (chartH - 20) : 0;
              const bx = cx0 + 30 + (i - 1) * colW + colW * 0.2;
              const bw = colW * 0.6;
              doc.setFillColor(...GOLD); doc.roundedRect(bx, cy0 + chartH - h, bw, h, 2, 2, "F");
              doc.setFontSize(7); doc.setTextColor(...MUTED);
              doc.text(`Ano ${i}`, bx + bw / 2, cy0 + chartH + 12, { align: "center" });
              doc.setFontSize(7); doc.setTextColor(...NAVY);
              doc.text(fmt(v).replace("R$", "").trim(), bx + bw / 2, cy0 + chartH - h - 4, { align: "center" });
            }
            y += chartH + 24;
          }
        }
        addPage();
      }

      // ==================== ESTRUTURA DE TIME ====================
      sectionHeader("05  ·  Pessoas", "Estrutura de time recomendada");
      y = 130;
      const revBandKey = REVENUE_BAND_TO_KEY(tenant.revenue_band);
      const areas = ["commercial", "ops", "finance", "product"];
      const areaLabel: Record<string, string> = { commercial: "Comercial", ops: "Operacoes", finance: "Financas", product: "Produto" };

      for (const a of areas) {
        const areaRoles = (bundle.roleTemplates as any[]).filter(r => r.area === a);
        if (!areaRoles.length) continue;
        ensureSpace(100, "Estrutura de time recomendada");
        doc.setFont("times", "bold"); doc.setFontSize(14); doc.setTextColor(...NAVY);
        doc.text(areaLabel[a] ?? a, MARGIN, y); y += 6;
        doc.setDrawColor(...GOLD); doc.line(MARGIN, y, MARGIN + 30, y); y += 8;

        const rows = areaRoles.map((r: any) => {
          const recArr = Array.isArray(r.recommended_headcount_by_revenue) ? r.recommended_headcount_by_revenue as any[] : [];
          const rec = recArr.find(x => x.revenue_band === revBandKey);
          return [
            clean(r.role_name) + (r.seniority ? `\n(${clean(r.seniority)})` : ""),
            clean(r.description ?? ""),
            Array.isArray(r.framework_keys) ? r.framework_keys.map(clean).join(", ") : "",
            rec ? `${rec.count}` : "-",
          ];
        });
        autoTable(doc, {
          startY: y + 6,
          head: [["Papel", "Descricao", "Frameworks", "Headcount"]],
          body: rows,
          margin: { left: MARGIN, right: MARGIN },
          theme: "grid",
          styles: { font: "helvetica", fontSize: 9, cellPadding: 6, textColor: INK, lineColor: LINE, valign: "top" },
          headStyles: { fillColor: BG, textColor: NAVY, fontStyle: "bold" },
          columnStyles: {
            0: { fontStyle: "bold", cellWidth: 110, textColor: NAVY },
            2: { cellWidth: 90, textColor: MUTED, fontSize: 8 },
            3: { cellWidth: 60, halign: "center", fontStyle: "bold", textColor: GREEN },
          },
        });
        y = (doc as any).lastAutoTable.finalY + 16;
      }
      addPage();

      // ==================== RITUAIS ====================
      sectionHeader("06  ·  Cadencia", "Rituais ativos");
      y = 130;
      if (bundle.rituals.length) {
        bundle.rituals.forEach((r: any) => {
          ensureSpace(100, "Rituais ativos");
          doc.setFillColor(...BG); doc.roundedRect(MARGIN, y, CONTENT_W, 26, 4, 4, "F");
          doc.setFillColor(...GREEN); doc.rect(MARGIN, y, 4, 26, "F");
          doc.setFont("times", "bold"); doc.setFontSize(12); doc.setTextColor(...NAVY);
          doc.text(clean(r.name), MARGIN + 16, y + 17);
          if (r.cadence) {
            doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...MUTED);
            doc.text(clean(r.cadence), W - MARGIN - 14, y + 17, { align: "right" });
          }
          y += 36;
          doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...INK);
          ((r.agenda_json as any[]) ?? []).forEach((item: any) => {
            ensureSpace(20, "Rituais ativos");
            const text = typeof item === "string" ? item : (item?.item ?? "");
            bullet(MARGIN + 22, y, GREEN);
            y = writeLines(text, MARGIN + 30, y, CONTENT_W - 40, 13);
            y += 2;
          });
          y += 10;
        });
      } else {
        doc.setFont("helvetica", "italic"); doc.setFontSize(10); doc.setTextColor(...MUTED);
        doc.text("Nenhum ritual ativo ainda.", MARGIN, y);
      }
      addPage();

      // ==================== ANÁLISE ESTRATÉGICA IA ====================
      const ai = (bundle as any).aiPlan?.content_json;

      if (ai) {
        sectionHeader("07  ·  Inteligencia", "Analise estrategica por IA");
        y = 130;

        if (ai.resumo_executivo) {
          // bloco destacado
          const text = clean(ai.resumo_executivo);
          const lines = doc.splitTextToSize(text, CONTENT_W - 40);
          const blockH = lines.length * 14 + 36;
          doc.setFillColor(...BG); doc.roundedRect(MARGIN, y, CONTENT_W, blockH, 6, 6, "F");
          doc.setFillColor(...GOLD); doc.rect(MARGIN, y, 4, blockH, "F");
          doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...GOLD);
          doc.text("DIAGNOSTICO", MARGIN + 20, y + 22, { charSpace: 1.5 });
          doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...INK);
          doc.text(lines, MARGIN + 20, y + 40);
          y += blockH + 18;
        }

        if (Array.isArray(ai.prioridades) && ai.prioridades.length) {
          ensureSpace(60, "Analise estrategica por IA");
          doc.setFont("times", "bold"); doc.setFontSize(14); doc.setTextColor(...NAVY);
          doc.text("Prioridades estrategicas", MARGIN, y); y += 6;
          doc.setDrawColor(...GOLD); doc.line(MARGIN, y, MARGIN + 30, y); y += 16;

          ai.prioridades.forEach((p: any, i: number) => {
            const titleLines = doc.splitTextToSize(clean(p.titulo), CONTENT_W - 80);
            const bodyLines = doc.splitTextToSize(clean(p.porque), CONTENT_W - 50);
            const blockH = 28 + titleLines.length * 14 + bodyLines.length * 13;
            ensureSpace(blockH + 12, "Prioridades estrategicas");

            // número grande
            doc.setFont("times", "bold"); doc.setFontSize(28); doc.setTextColor(...GOLD);
            doc.text(`0${i + 1}`, MARGIN, y + 6);
            // tag de impacto
            const tag = clean(p.impacto ?? "").toUpperCase();
            const tagColor: [number, number, number] = tag === "ALTO" ? [180, 52, 52] : tag === "MEDIO" ? GOLD : [110, 130, 110];
            if (tag) {
              doc.setFillColor(...tagColor); doc.roundedRect(W - MARGIN - 60, y - 8, 60, 16, 8, 8, "F");
              doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.setTextColor(255);
              doc.text(tag, W - MARGIN - 30, y + 2, { align: "center", charSpace: 1 });
            }
            doc.setFont("times", "bold"); doc.setFontSize(12); doc.setTextColor(...NAVY);
            doc.text(titleLines, MARGIN + 40, y); y += titleLines.length * 14 + 4;
            doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...INK);
            doc.text(bodyLines, MARGIN + 40, y); y += bodyLines.length * 13 + 16;
          });
        }

        if (Array.isArray(ai.frameworks_recomendados) && ai.frameworks_recomendados.length) {
          ensureSpace(80, "Frameworks recomendados");
          doc.setFont("times", "bold"); doc.setFontSize(14); doc.setTextColor(...NAVY);
          doc.text("Frameworks recomendados", MARGIN, y); y += 6;
          doc.setDrawColor(...GOLD); doc.line(MARGIN, y, MARGIN + 30, y); y += 16;

          ai.frameworks_recomendados.forEach((f: any) => {
            ensureSpace(80, "Frameworks recomendados");
            doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...NAVY);
            doc.text(clean(f.nome), MARGIN, y); y += 14;
            doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...GOLD);
            doc.text("Quando usar", MARGIN, y); y += 12;
            doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...INK);
            y = writeLines(clean(f.quando_usar), MARGIN, y, CONTENT_W); y += 6;
            doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...GOLD);
            doc.text("Primeiro passo", MARGIN, y); y += 12;
            doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...INK);
            y = writeLines(clean(f.primeiro_passo), MARGIN, y, CONTENT_W); y += 16;
          });
        }

        if (Array.isArray(ai.sugestoes_okrs) && ai.sugestoes_okrs.length) {
          addPage();
          sectionHeader("08  ·  Sugestoes da IA", "OKRs sugeridos");
          y = 130;
          ai.sugestoes_okrs.forEach((o: any) => {
            ensureSpace(80, "OKRs sugeridos");
            doc.setFillColor(...NAVY); doc.roundedRect(MARGIN, y, CONTENT_W, 28, 4, 4, "F");
            doc.setFont("times", "bold"); doc.setFontSize(11); doc.setTextColor(255);
            const tl = doc.splitTextToSize(clean(o.objetivo), CONTENT_W - 28);
            doc.text(tl[0], MARGIN + 14, y + 18);
            y += 36;
            if (o.por_que) {
              doc.setFont("helvetica", "italic"); doc.setFontSize(9); doc.setTextColor(...MUTED);
              y = writeLines(clean(o.por_que), MARGIN, y, CONTENT_W); y += 8;
            }
            const krRows = (o.key_results ?? []).map((kr: any) => [
              clean(kr.kr),
              clean(kr.meta ?? ""),
              clean(kr.baseline ?? "-"),
              clean(kr.kpi_acompanhamento ?? ""),
            ]);
            if (krRows.length) {
              autoTable(doc, {
                startY: y,
                head: [["Key Result", "Meta", "Baseline", "KPI"]],
                body: krRows,
                margin: { left: MARGIN, right: MARGIN },
                theme: "grid",
                styles: { font: "helvetica", fontSize: 9, cellPadding: 6, textColor: INK, lineColor: LINE, valign: "top" },
                headStyles: { fillColor: BG, textColor: NAVY, fontStyle: "bold" },
                columnStyles: { 1: { cellWidth: 80 }, 2: { cellWidth: 70 }, 3: { cellWidth: 110, textColor: MUTED } },
              });
              y = (doc as any).lastAutoTable.finalY + 14;
            }
          });
          addPage();
        }

        if (ai.sugestoes_visao) {
          sectionHeader("09  ·  Refino de norte", "Visao sugerida pela IA");
          y = 130;
          const v = ai.sugestoes_visao;
          const renderRefino = (label: string, val: string) => {
            if (!val) return;
            ensureSpace(60, "Visao sugerida pela IA");
            doc.setFillColor(...BG); doc.roundedRect(MARGIN, y, CONTENT_W, 12, 0, 0, "F");
            doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...GOLD);
            doc.text(label.toUpperCase(), MARGIN + 10, y + 9, { charSpace: 1.5 });
            y += 20;
            doc.setFont("times", "bold"); doc.setFontSize(13); doc.setTextColor(...NAVY);
            y = writeLines(clean(val), MARGIN, y, CONTENT_W, 16); y += 14;
          };
          renderRefino("North Star", v.north_star_refinado);
          renderRefino("Missao", v.missao_refinada);
          if (Array.isArray(v.valores_sugeridos) && v.valores_sugeridos.length) {
            renderRefino("Valores", v.valores_sugeridos.map(clean).join("  ·  "));
          }
          y += 10;
        }

        if (Array.isArray(ai.sugestoes_time) && ai.sugestoes_time.length) {
          ensureSpace(120, "Sugestoes da IA");
          doc.setFont("times", "bold"); doc.setFontSize(14); doc.setTextColor(...NAVY);
          doc.text("Time - posicoes-chave sugeridas", MARGIN, y); y += 6;
          doc.setDrawColor(...GOLD); doc.line(MARGIN, y, MARGIN + 30, y); y += 12;

          const rows = ai.sugestoes_time.map((t: any) => [
            clean(t.papel),
            clean(t.area),
            clean(t.prioridade ?? "").toUpperCase(),
            clean(t.por_que),
          ]);
          autoTable(doc, {
            startY: y + 4,
            head: [["Papel", "Area", "Prioridade", "Por que"]],
            body: rows,
            margin: { left: MARGIN, right: MARGIN },
            theme: "grid",
            styles: { font: "helvetica", fontSize: 9, cellPadding: 6, textColor: INK, lineColor: LINE, valign: "top" },
            headStyles: { fillColor: BG, textColor: NAVY, fontStyle: "bold" },
            columnStyles: {
              0: { fontStyle: "bold", cellWidth: 110, textColor: NAVY },
              1: { cellWidth: 70 },
              2: { cellWidth: 70, fontStyle: "bold", halign: "center" },
            },
            didParseCell: (data) => {
              if (data.column.index === 2 && data.section === "body") {
                const v = String(data.cell.raw ?? "");
                if (v === "URGENTE" || v === "ALTA") data.cell.styles.textColor = [180, 52, 52];
                else if (v === "MEDIA") data.cell.styles.textColor = GOLD;
                else data.cell.styles.textColor = MUTED;
              }
            },
          });
          y = (doc as any).lastAutoTable.finalY + 16;
        }

        if (Array.isArray(ai.sugestoes_rituais) && ai.sugestoes_rituais.length) {
          ensureSpace(120, "Sugestoes da IA");
          doc.setFont("times", "bold"); doc.setFontSize(14); doc.setTextColor(...NAVY);
          doc.text("Rituais sugeridos pela IA", MARGIN, y); y += 6;
          doc.setDrawColor(...GOLD); doc.line(MARGIN, y, MARGIN + 30, y); y += 12;

          const rows = ai.sugestoes_rituais.map((r: any) => [
            clean(r.ritual),
            clean(r.cadencia ?? ""),
            clean(r.participantes ?? ""),
            clean(r.pauta_resumida ?? ""),
          ]);
          autoTable(doc, {
            startY: y + 4,
            head: [["Ritual", "Cadencia", "Participantes", "Pauta"]],
            body: rows,
            margin: { left: MARGIN, right: MARGIN },
            theme: "grid",
            styles: { font: "helvetica", fontSize: 9, cellPadding: 6, textColor: INK, lineColor: LINE, valign: "top" },
            headStyles: { fillColor: BG, textColor: NAVY, fontStyle: "bold" },
            columnStyles: {
              0: { fontStyle: "bold", cellWidth: 110, textColor: NAVY },
              1: { cellWidth: 80, textColor: GREEN, fontStyle: "bold" },
            },
          });
          y = (doc as any).lastAutoTable.finalY + 16;
        }

        if (ai.projecao_ideal) {
          ensureSpace(160, "Sugestoes da IA");
          doc.setFont("times", "bold"); doc.setFontSize(14); doc.setTextColor(...NAVY);
          doc.text("Projecao ideal (12 meses)", MARGIN, y); y += 6;
          doc.setDrawColor(...GOLD); doc.line(MARGIN, y, MARGIN + 30, y); y += 14;
          const p = ai.projecao_ideal;

          // dois cards de meta
          const cardW = (CONTENT_W - 12) / 2;
          [
            ["Receita meta 12m", clean(p.receita_meta_12m)],
            ["Margem EBITDA alvo", clean(p.margem_ebitda_alvo)],
          ].forEach((c, i) => {
            const cx = MARGIN + i * (cardW + 12);
            doc.setFillColor(...NAVY); doc.roundedRect(cx, y, cardW, 56, 6, 6, "F");
            doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...GOLD);
            doc.text(c[0].toUpperCase(), cx + 14, y + 18, { charSpace: 1.2 });
            doc.setFont("times", "bold"); doc.setFontSize(16); doc.setTextColor(255);
            doc.text(c[1], cx + 14, y + 42);
          });
          y += 70;

          if (p.premissas) {
            doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...GOLD);
            doc.text("PREMISSAS", MARGIN, y); y += 12;
            doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...INK);
            y = writeLines(clean(p.premissas), MARGIN, y, CONTENT_W); y += 12;
          }

          if (Array.isArray(p.principais_alavancas) && p.principais_alavancas.length) {
            doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...GOLD);
            doc.text("PRINCIPAIS ALAVANCAS", MARGIN, y); y += 14;
            p.principais_alavancas.forEach((a: string) => {
              ensureSpace(40, "Sugestoes da IA");
              bullet(MARGIN + 6, y);
              y = writeLines(clean(a), MARGIN + 16, y, CONTENT_W - 16); y += 4;
            });
          }
        }

        if (Array.isArray(ai.plano_90_dias) && ai.plano_90_dias.length) {
          addPage();
          sectionHeader("10  ·  Execucao", "Plano de acao 90 dias");
          y = 130;
          doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...MUTED);
          y = writeLines("Roadmap executivo gerado pela IA com owners e resultados esperados por sprint.", MARGIN, y, CONTENT_W); y += 14;

          ai.plano_90_dias.forEach((step: any, idx: number) => {
            const ownerTxt = clean(step.owner_sugerido ?? "");
            const resultTxt = clean(step.resultado_esperado ?? "");
            const acaoLines = doc.splitTextToSize(clean(step.acao ?? ""), CONTENT_W - 100);
            const ownerLines = doc.splitTextToSize(`Owner: ${ownerTxt}`, CONTENT_W - 100);
            const resultLines = doc.splitTextToSize(`Resultado: ${resultTxt}`, CONTENT_W - 100);
            const blockH = 24 + acaoLines.length * 13 + ownerLines.length * 12 + resultLines.length * 12 + 12;
            ensureSpace(blockH + 10, "Plano de acao 90 dias");

            // timeline marker
            doc.setFillColor(...GOLD); doc.circle(MARGIN + 10, y + 6, 5, "F");
            doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(255);
            doc.text(`${idx + 1}`, MARGIN + 10, y + 9, { align: "center" });

            doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...GOLD);
            doc.text(clean(step.semana ?? "").toUpperCase(), MARGIN + 28, y + 9, { charSpace: 1 });
            y += 22;

            doc.setFont("times", "bold"); doc.setFontSize(11); doc.setTextColor(...NAVY);
            doc.text(acaoLines, MARGIN + 28, y); y += acaoLines.length * 13 + 4;
            doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...INK);
            doc.text(ownerLines, MARGIN + 28, y); y += ownerLines.length * 12 + 2;
            doc.setTextColor(...GREEN);
            doc.text(resultLines, MARGIN + 28, y); y += resultLines.length * 12 + 14;

            // linha vertical da timeline (decorativa)
            if (idx < ai.plano_90_dias.length - 1) {
              doc.setDrawColor(...LINE); doc.setLineWidth(1);
              doc.line(MARGIN + 10, y - 8, MARGIN + 10, y + 4);
            }
          });
        }
        footer();
      } else {
        sectionHeader("07  ·  Proximos passos", "Plano de acao 90 dias");
        y = 130;
        doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...INK);
        const actions = [
          "Mes 1 - Alinhamento: comunicar visao a todo o time, ativar daily e weekly.",
          "Mes 1 - Defina e publique os OKRs do trimestre.",
          "Mes 2 - Construir DRE projetado em 3 cenarios e metas comerciais.",
          "Mes 2 - Estabelecer 1:1 quinzenais e quarter review do proximo ciclo.",
          "Mes 3 - Quarter review formal: revisar score dos OKRs e ajustar plano.",
        ];
        actions.forEach(a => {
          bullet(MARGIN + 6, y); y = writeLines(a, MARGIN + 16, y, CONTENT_W - 16); y += 8;
        });
        footer();
      }

      doc.save(`StrategicOS_${(tenant.name ?? "plano").replace(/\s+/g, "_")}.pdf`);
      toast.success("PDF gerado!");

      try {
        if (tenantId) {
          await (supabase.rpc as any)("log_event", {
            p_tenant_id: tenantId,
            p_action: "pdf_generated",
            p_entity_type: "tenant",
            p_entity_id: tenantId,
            p_payload: { pages: page, generated_at: new Date().toISOString(), ai_plan: !!ai },
          });
        }
      } catch (e) {
        captureError(e, { step: "log_event pdf_generated" });
      }
    } catch (e: any) {
      captureError(e, { component: "ExportPDF.generate" });
      toast.error(e?.message ?? "Erro ao gerar PDF");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <FileDown className="h-7 w-7 text-accent" />
        <div>
          <h1 className="font-serif text-3xl font-bold text-primary">Exportar PDF</h1>
          <p className="text-muted-foreground">Gere o plano estratégico completo branded.</p>
        </div>
      </div>

      <Card className="shadow-soft">
        <CardHeader><CardTitle className="font-serif">Conteúdo do PDF</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <ul className="space-y-2">
            {[
              "Capa branded O2inc × G4 com nome da empresa, CNPJ e data",
              "Sumário executivo: score de maturidade, top 3 prioridades e top 3 frameworks recomendados",
              "Norte estratégico 5 / 3 / 1 ano (North Star, missão, valores) — refinado pela IA e amarrado às metas financeiras",
              "OKRs vigentes + OKRs sugeridos pela IA com KRs mensuráveis e KPIs de acompanhamento",
              "Projeção financeira 1 / 3 / 5 anos em 3 cenários, com leitura crítica das premissas, riscos e alavancas pela IA",
              "Roadmap de contratações priorizado pela IA (0-6m, 6-12m, 12-24m) por área e seniority",
              "Calendário de rituais ativos + ordem de implantação recomendada pela IA",
              "Plano de ação executivo de 90 dias gerado pela IA com owners e resultados esperados",
            ].map(t => <li key={t} className="flex gap-2"><span className="text-accent">›</span>{t}</li>)}
          </ul>

          <div className="pt-4 border-t mt-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <div className="font-medium text-foreground">Análise estratégica por IA</div>
                <div className="text-xs text-muted-foreground">
                  {(bundle as any)?.aiPlan
                    ? `Plano gerado em ${new Date((bundle as any).aiPlan.generated_at ?? (bundle as any).aiPlan.created_at).toLocaleString("pt-BR")}.`
                    : "Ainda não gerado. Será gerado automaticamente após o onboarding ou clique abaixo."}
                </div>
              </div>
              <Button variant="outline" onClick={regenerateAi}>
                {(bundle as any)?.aiPlan ? "Regerar com IA" : "Gerar com IA"}
              </Button>
            </div>
          </div>

          <div className="pt-2">
            <Button onClick={generate} disabled={generating} className="bg-accent hover:bg-accent/90 text-accent-foreground shadow-gold">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <><FileDown className="h-4 w-4 mr-2" /> Gerar PDF agora</>}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
