import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileDown, Loader2 } from "lucide-react";
import { useState } from "react";
import jsPDF from "jspdf";
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

      const NAVY: [number, number, number] = [11, 31, 58];
      const GOLD: [number, number, number] = [201, 162, 74];
      const GREEN: [number, number, number] = [30, 81, 40];
      const INK: [number, number, number] = [40, 40, 50];

      const fmt = (n: number) =>
        n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

      const footer = (page: number) => {
        doc.setFontSize(8); doc.setTextColor(120);
        doc.text("Strategic OS · O2inc × G4 Educação", 40, H - 25);
        doc.text(`pág. ${page}`, W - 40, H - 25, { align: "right" });
      };

      // Cover
      doc.setFillColor(...NAVY); doc.rect(0, 0, W, H, "F");
      doc.setFillColor(...GOLD); doc.rect(0, H - 6, W, 6, "F");
      doc.setTextColor(...GOLD); doc.setFontSize(11); doc.setFont("helvetica", "bold");
      doc.text("STRATEGIC OS", 50, 60);
      doc.setTextColor(255); doc.setFont("helvetica", "normal"); doc.setFontSize(9);
      doc.text("O2inc × G4 Educação", 50, 76);

      doc.setFont("times", "bold"); doc.setFontSize(40); doc.setTextColor(255);
      doc.text("Plano Estratégico", 50, H / 2 - 30);
      doc.setFontSize(28); doc.setTextColor(...GOLD);
      doc.text(tenant.name ?? "Workspace", 50, H / 2 + 10);
      doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(220);
      if (tenant.sector) doc.text(`Setor: ${tenant.sector}  ·  Porte: ${tenant.size_band ?? "—"}`, 50, H / 2 + 36);
      if (tenant.cnpj) doc.text(`CNPJ: ${tenant.cnpj}`, 50, H / 2 + 56);
      doc.text(today, 50, H - 60);
      doc.addPage();

      let page = 2;
      const newSection = (title: string) => {
        doc.setFillColor(...NAVY); doc.rect(0, 0, W, 80, "F");
        doc.setTextColor(...GOLD); doc.setFontSize(10); doc.setFont("helvetica", "bold");
        doc.text("STRATEGIC OS", 40, 32);
        doc.setTextColor(255); doc.setFont("times", "bold"); doc.setFontSize(22);
        doc.text(title, 40, 60);
      };

      const writeLines = (text: string, x: number, y: number, maxWidth: number, lineHeight = 14) => {
        const lines = doc.splitTextToSize(text, maxWidth);
        doc.text(lines, x, y);
        return y + lines.length * lineHeight;
      };

      // ============ Sumário executivo ============
      newSection("Sumário executivo");
      const matValues = Object.values(bundle.maturity);
      const overall = matValues.length ? Math.round(matValues.reduce((a, b) => a + b, 0) / matValues.length) : 0;
      doc.setTextColor(...INK); doc.setFont("helvetica", "normal"); doc.setFontSize(11);
      let y = 110;
      doc.setFont("helvetica", "bold"); doc.text(`Score de maturidade geral: ${overall}/100`, 40, y); y += 24;
      doc.setFont("helvetica", "normal");
      Object.entries(bundle.maturity).forEach(([k, v]) => {
        doc.text(`• ${DIM_LABEL[k] ?? k}: ${v}/100`, 60, y); y += 18;
      });
      y += 12;
      doc.setFont("helvetica", "bold"); doc.text("Top 3 prioridades:", 40, y); y += 18;
      doc.setFont("helvetica", "normal");
      const top3 = Object.entries(bundle.maturity).sort((a, b) => a[1] - b[1]).slice(0, 3);
      const recommendedFrameworkKeys = new Set<string>();
      top3.forEach(([k]) => {
        const name =
          k === "vision" ? "Fortalecer visão e cascata estratégica" :
          k === "okrs" ? "Implantar ciclo de OKRs trimestrais" :
          k === "rituals" ? "Estabelecer rituais de gestão" :
          k === "team" ? "Estruturar organograma e responsabilidades" :
          "Construir DRE projetado e cenários";
        doc.text(`› ${name}`, 60, y); y += 18;
        (FRAMEWORK_RECOMMENDATIONS_BY_DIM[k] ?? []).forEach(fk => recommendedFrameworkKeys.add(fk));
      });

      y += 10;
      doc.setFont("helvetica", "bold"); doc.text("Top 3 frameworks recomendados:", 40, y); y += 18;
      doc.setFont("helvetica", "normal");
      const recFrameworks = (bundle.frameworks as any[])
        .filter(f => recommendedFrameworkKeys.has(f.key))
        .slice(0, 3);
      if (recFrameworks.length === 0) {
        doc.text("• Implante OKR como sistema de objetivos.", 60, y); y += 16;
        doc.text("• Use RACI pra clarear responsabilidades.", 60, y); y += 16;
        doc.text("• Eisenhower pra priorização do CEO.", 60, y); y += 16;
      } else {
        recFrameworks.forEach(f => {
          doc.text(`• ${f.name} — ${f.when_to_apply ?? ""}`, 60, y); y += 16;
        });
      }
      footer(page); doc.addPage(); page++;

      // ============ Visão estratégica ============
      newSection("Visão estratégica"); y = 110;
      [5, 3, 1].forEach(h => {
        const p = bundle.vision.find(v => v.year_horizon === h);
        doc.setFont("times", "bold"); doc.setFontSize(16); doc.setTextColor(...NAVY);
        doc.text(`${h} ano${h > 1 ? "s" : ""}`, 40, y); y += 18;
        doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...INK);
        if (p?.north_star) {
          doc.setFont("helvetica", "bold"); doc.text("North Star: ", 40, y);
          doc.setFont("helvetica", "normal"); y = writeLines(p.north_star, 100, y, W - 140); y += 6;
        }
        if (p?.mission) {
          doc.setFont("helvetica", "bold"); doc.text("Missão: ", 40, y);
          doc.setFont("helvetica", "normal"); y = writeLines(p.mission, 100, y, W - 140); y += 6;
        }
        const values = Array.isArray((p as any)?.values_json) ? ((p as any).values_json as any[]) : [];
        if (values.length) {
          doc.setFont("helvetica", "bold"); doc.text("Valores: ", 40, y);
          doc.setFont("helvetica", "normal"); y = writeLines(values.join(", "), 100, y, W - 140); y += 6;
        }
        y += 10;
      });
      footer(page); doc.addPage(); page++;

      // ============ OKRs ============
      newSection("OKRs vigentes"); y = 110;
      doc.setFontSize(10); doc.setTextColor(...INK);
      bundle.objectives.forEach((o: any) => {
        if (y > H - 100) { footer(page); doc.addPage(); page++; newSection("OKRs (cont.)"); y = 110; }
        doc.setFont("helvetica", "bold"); doc.setTextColor(...NAVY);
        y = writeLines(`◆ ${o.title}${o.quarter ? `  [${o.quarter}]` : ""}`, 40, y, W - 80);
        doc.setFont("helvetica", "normal"); doc.setTextColor(...INK);
        (o.key_results ?? []).forEach((kr: any) => {
          const pct = kr.target ? Math.round(((kr.current ?? 0) / kr.target) * 100) : 0;
          y = writeLines(`   • ${kr.title} — ${kr.current ?? 0}/${kr.target} (${pct}%)`, 50, y, W - 100);
        });
        y += 10;
      });
      footer(page); doc.addPage(); page++;

      // ============ Projeção financeira (3 cenários, 1 página por cenário) ============
      const SCENARIO_LABELS: Record<string, string> = {
        optimistic: "Otimista",
        realistic: "Realista",
        pessimistic: "Pessimista",
      };
      const HORIZON = 5;
      for (const scenarioKey of ["optimistic", "realistic", "pessimistic"] as const) {
        newSection(`Projeção financeira — ${SCENARIO_LABELS[scenarioKey]}`); y = 110;
        doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...INK);
        const proj = (bundle.projections as any[]).find(p => p.scenario === scenarioKey && p.horizon_years === HORIZON);
        const dreRows = (bundle.dre as any[]).filter(d => proj && d.projection_id === proj.id);

        if (!proj || dreRows.length === 0) {
          doc.text("Nenhuma projeção persistida ainda. Acesse /financial e ajuste as premissas.", 40, y);
        } else {
          // Premissas
          const ij = (proj.inputs_json as any) ?? {};
          doc.setFont("helvetica", "bold"); doc.text("Premissas:", 40, y); y += 16;
          doc.setFont("helvetica", "normal");
          const baseInputs = ij.base_inputs ?? {};
          doc.text(`• Receita base: ${fmt(Number(baseInputs.revenue ?? ij.revenue_year1 ?? 0))}`, 60, y); y += 14;
          doc.text(`• Crescimento anual: ${baseInputs.growth ?? Math.round((ij.growth_rate ?? 0) * 100)}% × multiplier ${(ij.scenario_multiplier ?? 1).toFixed(2)}`, 60, y); y += 14;
          doc.text(`• Margem EBITDA: ${baseInputs.margin ?? Math.round((ij.ebitda_margin ?? 0) * 100)}%`, 60, y); y += 14;
          doc.text(`• Imposto: ${baseInputs.tax ?? Math.round((ij.effective_tax ?? 0) * 100)}%`, 60, y); y += 22;

          // Tabela DRE 5y
          doc.setFont("helvetica", "bold"); doc.text("DRE projetado:", 40, y); y += 16;

          // Pivota dre rows: linha por label, colunas anos 1..5
          const labels = ["Receita", "OPEX", "EBITDA", "Lucro líquido"];
          const byYearLabel: Record<string, Record<number, number>> = {};
          for (const r of dreRows) {
            byYearLabel[r.label] = byYearLabel[r.label] ?? {};
            byYearLabel[r.label][r.year] = Number(r.amount);
          }

          const colW = (W - 80 - 100) / HORIZON;
          doc.setFont("helvetica", "bold"); doc.setFontSize(9);
          doc.text("Linha", 40, y);
          for (let yr = 1; yr <= HORIZON; yr++) {
            doc.text(`Ano ${yr}`, 140 + (yr - 1) * colW, y, { align: "left" });
          }
          y += 14;
          doc.setFont("helvetica", "normal");
          for (const label of labels) {
            doc.text(label, 40, y);
            for (let yr = 1; yr <= HORIZON; yr++) {
              const val = byYearLabel[label]?.[yr] ?? 0;
              doc.text(fmt(val), 140 + (yr - 1) * colW, y);
            }
            y += 14;
          }
        }
        footer(page); doc.addPage(); page++;
      }

      // ============ Estrutura de Time recomendada ============
      newSection("Estrutura de time recomendada"); y = 110;
      doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...INK);
      const revBandKey = REVENUE_BAND_TO_KEY(tenant.revenue_band);
      const areas = ["commercial", "ops", "finance", "product"];
      const areaLabel: Record<string, string> = { commercial: "Comercial", ops: "Operações", finance: "Finanças", product: "Produto" };

      for (const a of areas) {
        if (y > H - 100) { footer(page); doc.addPage(); page++; newSection("Estrutura de time (cont.)"); y = 110; }
        const areaRoles = (bundle.roleTemplates as any[]).filter(r => r.area === a);
        if (!areaRoles.length) continue;
        doc.setFont("times", "bold"); doc.setFontSize(13); doc.setTextColor(...NAVY);
        doc.text(areaLabel[a] ?? a, 40, y); y += 18;
        doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...INK);
        for (const r of areaRoles) {
          if (y > H - 90) { footer(page); doc.addPage(); page++; newSection("Estrutura de time (cont.)"); y = 110; }
          // Headcount recomendado por revenue_band
          const recArr = Array.isArray(r.recommended_headcount_by_revenue) ? r.recommended_headcount_by_revenue as any[] : [];
          const rec = recArr.find(x => x.revenue_band === revBandKey);
          const headcountTxt = rec ? `Recomendado: ${rec.count} pessoas` : "";

          doc.setFont("helvetica", "bold");
          y = writeLines(`▸ ${r.role_name}${r.seniority ? `  (${r.seniority})` : ""}`, 40, y, W - 80);
          doc.setFont("helvetica", "normal");
          if (r.description) y = writeLines(r.description, 50, y, W - 100);
          if (Array.isArray(r.framework_keys) && r.framework_keys.length) {
            y = writeLines(`Frameworks: ${r.framework_keys.join(", ")}`, 50, y, W - 100);
          }
          if (headcountTxt) y = writeLines(headcountTxt, 50, y, W - 100);
          y += 8;
        }
      }
      footer(page); doc.addPage(); page++;

      // ============ Rituais ============
      newSection("Rituais ativos"); y = 110;
      doc.setFontSize(11); doc.setTextColor(...INK);
      if (bundle.rituals.length) {
        bundle.rituals.forEach((r: any) => {
          if (y > H - 100) { footer(page); doc.addPage(); page++; newSection("Rituais (cont.)"); y = 110; }
          doc.setFont("helvetica", "bold"); doc.setTextColor(...GREEN);
          y = writeLines(`■ ${r.name}`, 40, y, W - 80);
          doc.setFont("helvetica", "normal"); doc.setTextColor(...INK);
          ((r.agenda_json as any[]) ?? []).forEach((item: any) => {
            const text = typeof item === "string" ? item : (item?.item ?? "");
            y = writeLines(`   – ${text}`, 50, y, W - 100, 13);
          });
          y += 10;
        });
      } else {
        doc.text("Nenhum ritual ativo ainda.", 40, y);
      }
      footer(page); doc.addPage(); page++;

      // ============ Plano de Ação Estratégico (IA) ============
      const ai = (bundle as any).aiPlan?.content_json;
      const ensureSpace = (need: number, contTitle: string) => {
        if (y > H - need) { footer(page); doc.addPage(); page++; newSection(contTitle); y = 110; }
      };
      const sectionHeader = (title: string) => {
        ensureSpace(120, title);
        doc.setFont("times", "bold"); doc.setFontSize(14); doc.setTextColor(...NAVY);
        doc.text(title, 40, y); y += 18;
        doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...INK);
      };

      if (ai) {
        newSection("Análise estratégica · IA"); y = 110;
        doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...INK);
        if (ai.resumo_executivo) {
          doc.setFont("helvetica", "bold"); doc.text("Diagnóstico:", 40, y); y += 14;
          doc.setFont("helvetica", "normal");
          y = writeLines(ai.resumo_executivo, 40, y, W - 80); y += 10;
        }
        if (Array.isArray(ai.prioridades) && ai.prioridades.length) {
          sectionHeader("Prioridades estratégicas");
          ai.prioridades.forEach((p: any, i: number) => {
            ensureSpace(60, "Prioridades (cont.)");
            doc.setFont("helvetica", "bold"); doc.setTextColor(...GOLD);
            y = writeLines(`${i + 1}. ${p.titulo}  [${p.impacto}]`, 40, y, W - 80);
            doc.setFont("helvetica", "normal"); doc.setTextColor(...INK);
            y = writeLines(p.porque, 50, y, W - 100); y += 6;
          });
        }
        if (Array.isArray(ai.frameworks_recomendados) && ai.frameworks_recomendados.length) {
          sectionHeader("Frameworks recomendados");
          ai.frameworks_recomendados.forEach((f: any) => {
            ensureSpace(60, "Frameworks (cont.)");
            doc.setFont("helvetica", "bold"); y = writeLines(`▸ ${f.nome}`, 40, y, W - 80);
            doc.setFont("helvetica", "normal");
            y = writeLines(`Quando usar: ${f.quando_usar}`, 50, y, W - 100);
            y = writeLines(`Primeiro passo: ${f.primeiro_passo}`, 50, y, W - 100); y += 6;
          });
        }
        if (Array.isArray(ai.sugestoes_okrs) && ai.sugestoes_okrs.length) {
          footer(page); doc.addPage(); page++;
          newSection("OKRs sugeridos pela IA"); y = 110;
          doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...INK);
          ai.sugestoes_okrs.forEach((o: any) => {
            ensureSpace(80, "OKRs sugeridos (cont.)");
            doc.setFont("helvetica", "bold"); doc.setTextColor(...NAVY);
            y = writeLines(`◆ ${o.objetivo}`, 40, y, W - 80);
            doc.setFont("helvetica", "italic"); doc.setTextColor(...INK);
            y = writeLines(o.por_que, 50, y, W - 100);
            doc.setFont("helvetica", "normal");
            (o.key_results ?? []).forEach((kr: any) => {
              ensureSpace(40, "OKRs sugeridos (cont.)");
              y = writeLines(`   • ${kr.kr}`, 50, y, W - 100);
              y = writeLines(`     Meta: ${kr.meta}${kr.baseline ? ` · Baseline: ${kr.baseline}` : ""} · KPI: ${kr.kpi_acompanhamento}`, 50, y, W - 100);
            });
            y += 8;
          });
        }
        if (ai.sugestoes_visao) {
          sectionHeader("Refino de Visão sugerido");
          const v = ai.sugestoes_visao;
          if (v.north_star_refinado) { doc.setFont("helvetica", "bold"); doc.text("North Star:", 40, y); y += 14; doc.setFont("helvetica", "normal"); y = writeLines(v.north_star_refinado, 40, y, W - 80); y += 6; }
          if (v.missao_refinada) { doc.setFont("helvetica", "bold"); doc.text("Missão:", 40, y); y += 14; doc.setFont("helvetica", "normal"); y = writeLines(v.missao_refinada, 40, y, W - 80); y += 6; }
          if (Array.isArray(v.valores_sugeridos) && v.valores_sugeridos.length) {
            doc.setFont("helvetica", "bold"); doc.text("Valores:", 40, y); y += 14; doc.setFont("helvetica", "normal");
            y = writeLines(v.valores_sugeridos.join(", "), 40, y, W - 80); y += 6;
          }
        }
        if (Array.isArray(ai.sugestoes_time) && ai.sugestoes_time.length) {
          sectionHeader("Time — posições-chave");
          ai.sugestoes_time.forEach((t: any) => {
            ensureSpace(50, "Time (cont.)");
            doc.setFont("helvetica", "bold"); y = writeLines(`▸ ${t.papel} (${t.area}) — ${t.prioridade}`, 40, y, W - 80);
            doc.setFont("helvetica", "normal"); y = writeLines(t.por_que, 50, y, W - 100); y += 4;
          });
        }
        if (Array.isArray(ai.sugestoes_rituais) && ai.sugestoes_rituais.length) {
          sectionHeader("Rituais sugeridos");
          ai.sugestoes_rituais.forEach((r: any) => {
            ensureSpace(60, "Rituais sugeridos (cont.)");
            doc.setFont("helvetica", "bold"); y = writeLines(`■ ${r.ritual} · ${r.cadencia}`, 40, y, W - 80);
            doc.setFont("helvetica", "normal");
            y = writeLines(`Participantes: ${r.participantes}`, 50, y, W - 100);
            y = writeLines(`Pauta: ${r.pauta_resumida}`, 50, y, W - 100); y += 4;
          });
        }
        if (ai.projecao_ideal) {
          sectionHeader("Projeção ideal (12 meses)");
          const p = ai.projecao_ideal;
          y = writeLines(`Premissas: ${p.premissas}`, 40, y, W - 80);
          y = writeLines(`Receita meta: ${p.receita_meta_12m}`, 40, y, W - 80);
          y = writeLines(`Margem EBITDA alvo: ${p.margem_ebitda_alvo}`, 40, y, W - 80);
          if (Array.isArray(p.principais_alavancas)) {
            doc.setFont("helvetica", "bold"); y += 4; doc.text("Principais alavancas:", 40, y); y += 14;
            doc.setFont("helvetica", "normal");
            p.principais_alavancas.forEach((a: string) => { y = writeLines(`• ${a}`, 50, y, W - 100); });
          }
        }
        if (Array.isArray(ai.plano_90_dias) && ai.plano_90_dias.length) {
          footer(page); doc.addPage(); page++;
          newSection("Plano de ação · 90 dias (IA)"); y = 110;
          doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...INK);
          ai.plano_90_dias.forEach((step: any) => {
            ensureSpace(60, "Plano 90 dias (cont.)");
            doc.setFont("helvetica", "bold"); doc.setTextColor(...GREEN);
            y = writeLines(`✓ ${step.semana} — ${step.acao}`, 40, y, W - 80);
            doc.setFont("helvetica", "normal"); doc.setTextColor(...INK);
            y = writeLines(`Owner: ${step.owner_sugerido} · Resultado: ${step.resultado_esperado}`, 50, y, W - 100); y += 6;
          });
        }
        footer(page);
      } else {
        newSection("Plano de ação · próximos 90 dias"); y = 110;
        doc.setFontSize(11); doc.setTextColor(...INK);
        const actions = [
          "Mês 1 — Alinhamento: comunicar visão a todo o time, ativar daily e weekly.",
          "Mês 1 — Defina e publique os OKRs do trimestre.",
          "Mês 2 — Construir DRE projetado em 3 cenários e metas comerciais.",
          "Mês 2 — Estabelecer 1:1 quinzenais e quarter review do próximo ciclo.",
          "Mês 3 — Quarter review formal: revisar score dos OKRs e ajustar plano.",
        ];
        actions.forEach(a => { y = writeLines(`✓ ${a}`, 40, y, W - 80); y += 6; });
        footer(page);
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
