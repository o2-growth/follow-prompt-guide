import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileDown, Loader2 } from "lucide-react";
import { useState } from "react";
import jsPDF from "jspdf";
import { toast } from "sonner";

export default function ExportPDF() {
  const { data: m } = useTenant();
  const tenantId = m?.tenant_id;
  const [generating, setGenerating] = useState(false);

  const { data: bundle } = useQuery({
    queryKey: ["export-bundle", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const [vision, objectives, maturity, rituals] = await Promise.all([
        supabase.from("vision_plans").select("*").eq("tenant_id", tenantId!),
        supabase.from("okrs_objectives").select("*, key_results(*)").eq("tenant_id", tenantId!),
        supabase.from("maturity_assessments").select("*").eq("tenant_id", tenantId!).order("taken_at", { ascending: false }),
        supabase.from("rituals").select("*").eq("tenant_id", tenantId!).eq("active", true),
      ]);
      const latestMaturity: Record<string, number> = {};
      (maturity.data ?? []).forEach(a => { if (latestMaturity[a.dimension] === undefined) latestMaturity[a.dimension] = a.score; });
      return { vision: vision.data ?? [], objectives: objectives.data ?? [], maturity: latestMaturity, rituals: rituals.data ?? [] };
    },
  });

  const generate = async () => {
    if (!bundle || !m) return;
    setGenerating(true);
    try {
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const W = doc.internal.pageSize.getWidth();
      const H = doc.internal.pageSize.getHeight();
      const tenant = (m.tenants as any) ?? {};
      const today = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

      const NAVY: [number, number, number] = [11, 31, 58];
      const GOLD: [number, number, number] = [201, 162, 74];
      const GREEN: [number, number, number] = [30, 81, 40];
      const INK: [number, number, number] = [40, 40, 50];

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

      // Sumário executivo
      newSection("Sumário executivo");
      const overall = Object.values(bundle.maturity).length
        ? Math.round(Object.values(bundle.maturity).reduce((a, b) => a + b, 0) / Object.values(bundle.maturity).length) : 0;
      doc.setTextColor(...INK); doc.setFont("helvetica", "normal"); doc.setFontSize(11);
      let y = 110;
      doc.setFont("helvetica", "bold"); doc.text(`Score de maturidade geral: ${overall}/100`, 40, y); y += 24;
      doc.setFont("helvetica", "normal");
      Object.entries(bundle.maturity).forEach(([k, v]) => {
        const name = k === "vision" ? "Visão" : k === "okrs" ? "OKRs" : k === "rituals" ? "Rituais" : k === "team" ? "Time" : "Financeiro";
        doc.text(`• ${name}: ${v}/100`, 60, y); y += 18;
      });
      y += 12;
      doc.setFont("helvetica", "bold"); doc.text("Top 3 prioridades:", 40, y); y += 18;
      doc.setFont("helvetica", "normal");
      const top3 = Object.entries(bundle.maturity).sort((a, b) => a[1] - b[1]).slice(0, 3);
      top3.forEach(([k]) => {
        const name = k === "vision" ? "Fortalecer visão e cascata estratégica" :
                     k === "okrs" ? "Implantar ciclo de OKRs trimestrais" :
                     k === "rituals" ? "Estabelecer rituais de gestão" :
                     k === "team" ? "Estruturar organograma e responsabilidades" :
                     "Construir DRE projetado e cenários";
        doc.text(`› ${name}`, 60, y); y += 18;
      });
      footer(page); doc.addPage(); page++;

      // Visão
      newSection("Visão estratégica"); y = 110;
      [5, 3, 1].forEach(h => {
        const p = bundle.vision.find(v => v.year_horizon === h);
        doc.setFont("times", "bold"); doc.setFontSize(16); doc.setTextColor(...NAVY);
        doc.text(`${h} ano${h > 1 ? "s" : ""}`, 40, y); y += 18;
        doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...INK);
        if (p?.north_star) { doc.setFont("helvetica", "bold"); doc.text("North Star: ", 40, y);
          doc.setFont("helvetica", "normal"); y = writeLines(p.north_star, 100, y, W - 140); y += 6; }
        if (p?.mission) { doc.setFont("helvetica", "bold"); doc.text("Missão: ", 40, y);
          doc.setFont("helvetica", "normal"); y = writeLines(p.mission, 100, y, W - 140); y += 6; }
        y += 14;
      });
      footer(page); doc.addPage(); page++;

      // OKRs
      newSection("OKRs vigentes"); y = 110;
      doc.setFontSize(10); doc.setTextColor(...INK);
      bundle.objectives.forEach((o: any) => {
        if (y > H - 100) { footer(page); doc.addPage(); page++; newSection("OKRs (cont.)"); y = 110; }
        doc.setFont("helvetica", "bold"); doc.setTextColor(...NAVY);
        y = writeLines(`◆ ${o.title}`, 40, y, W - 80);
        doc.setFont("helvetica", "normal"); doc.setTextColor(...INK);
        (o.key_results ?? []).forEach((kr: any) => {
          const pct = kr.target ? Math.round((kr.current / kr.target) * 100) : 0;
          y = writeLines(`   • ${kr.title} — ${kr.current ?? 0}/${kr.target} (${pct}%)`, 50, y, W - 100);
        });
        y += 10;
      });
      footer(page); doc.addPage(); page++;

      // Rituais
      newSection("Rituais ativos"); y = 110;
      doc.setFontSize(11); doc.setTextColor(...INK);
      if (bundle.rituals.length) {
        bundle.rituals.forEach(r => {
          doc.setFont("helvetica", "bold"); doc.setTextColor(...GREEN);
          y = writeLines(`■ ${r.name}`, 40, y, W - 80);
          doc.setFont("helvetica", "normal"); doc.setTextColor(...INK);
          (r.agenda_json as any[] ?? []).forEach(item => {
            y = writeLines(`   – ${item}`, 50, y, W - 100, 13);
          });
          y += 10;
        });
      } else { doc.text("Nenhum ritual ativo ainda.", 40, y); }
      footer(page); doc.addPage(); page++;

      // Plano de ação 90 dias
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

      doc.save(`StrategicOS_${(tenant.name ?? "plano").replace(/\s+/g, "_")}.pdf`);
      toast.success("PDF gerado!");
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao gerar PDF");
    } finally { setGenerating(false); }
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
              "Capa branded O2inc × G4 com nome da empresa e data",
              "Sumário executivo com score de maturidade e top 3 prioridades",
              "Visão estratégica 5 / 3 / 1 ano",
              "OKRs vigentes com Key Results e progresso",
              "Calendário de rituais ativos com agendas",
              "Plano de ação para os próximos 90 dias",
            ].map(t => <li key={t} className="flex gap-2"><span className="text-accent">›</span>{t}</li>)}
          </ul>
          <div className="pt-4">
            <Button onClick={generate} disabled={generating} className="bg-accent hover:bg-accent/90 text-accent-foreground shadow-gold">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <><FileDown className="h-4 w-4 mr-2" /> Gerar PDF agora</>}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
