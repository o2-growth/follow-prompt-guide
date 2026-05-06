import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Gauge } from "lucide-react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";
import { EmptyState } from "@/components/common/EmptyState";
import { cn } from "@/lib/utils";

const DIM_LABELS: Record<string, string> = { vision: "Visão", okrs: "OKRs", rituals: "Rituais", team: "Time", financial: "Financeiro" };

const RECS: Record<string, string[]> = {
  vision: ["Escreva sua visão de 5 anos em uma frase.", "Compartilhe a missão com todo o time mensalmente."],
  okrs: ["Defina 3 objetivos trimestrais com 2–4 KRs cada.", "Crie ritual semanal de check-in dos KRs."],
  rituals: ["Implante daily de 15 minutos na liderança.", "Inicie 1:1 quinzenais estruturados."],
  team: ["Desenhe o organograma das áreas-chave.", "Defina RACI dos processos críticos."],
  financial: ["Construa DRE projetado de 12 meses.", "Modele 3 cenários (otimista/realista/pessimista)."],
};

export default function Maturity() {
  const { data: m } = useTenant();
  const tenantId = m?.tenant_id;

  const { data } = useQuery({
    queryKey: ["maturity-full", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await supabase.from("maturity_assessments").select("*")
        .eq("tenant_id", tenantId!).order("taken_at", { ascending: false });
      const latest: Record<string, number> = {};
      (data ?? []).forEach(a => { if (latest[a.dimension] === undefined) latest[a.dimension] = a.score; });
      return latest;
    },
  });

  const radar = ["vision", "okrs", "rituals", "team", "financial"].map(d => ({
    dim: DIM_LABELS[d], score: data?.[d] ?? 0, key: d,
  }));
  const ranked = [...radar].sort((a, b) => a.score - b.score);
  const hasAssessment = !!data && Object.keys(data).length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Gauge className="h-7 w-7 text-accent" />
        <div>
          <h1 className="font-serif text-3xl font-bold text-primary">Maturidade</h1>
          <p className="text-muted-foreground">Diagnóstico em 5 dimensões e recomendações priorizadas.</p>
        </div>
      </div>

      {!hasAssessment && (
        <EmptyState
          icon={Gauge}
          title="Faça seu diagnóstico"
          description="Responda ao assessment de 5 dimensões (visão, OKRs, rituais, time e financeiro) para ver seu radar de maturidade e receber recomendações priorizadas."
          ctaLabel="Iniciar diagnóstico"
          ctaTo="/onboarding"
        />
      )}

      {hasAssessment && !radar.every(d => d.score === 0) && (
        <Card className="shadow-soft">
          <CardHeader><CardTitle className="font-serif">Radar de maturidade</CardTitle></CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radar}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="dim" tick={{ fill: "hsl(var(--foreground))", fontSize: 13 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                <Radar dataKey="score" stroke="hsl(var(--accent))" fill="hsl(var(--accent))" fillOpacity={0.4} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className={cn(!hasAssessment && "opacity-60 pointer-events-none")}>
        <h2 className="font-serif text-xl font-semibold text-primary mb-4">Recomendações priorizadas</h2>
        <div className="space-y-3">
          {ranked.map((r, i) => (
            <Card key={r.key} className="shadow-soft">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="font-serif text-lg">{i + 1}. {r.dim}</CardTitle>
                  <span className="text-sm font-semibold text-accent">{r.score}/100</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {RECS[r.key].map((rec, j) => (
                    <li key={j} className="flex gap-2"><span className="text-accent font-bold">›</span>{rec}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
