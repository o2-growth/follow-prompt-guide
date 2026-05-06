import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Compass, Target, TrendingUp, Users2, CalendarCheck, Gauge, FileDown, ArrowRight } from "lucide-react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";
import { EmptyState } from "@/components/common/EmptyState";

const QUICK = [
  { to: "/vision", icon: Compass, label: "Editar visão" },
  { to: "/okrs", icon: Target, label: "OKRs do trimestre" },
  { to: "/financial", icon: TrendingUp, label: "Projeção financeira" },
  { to: "/team", icon: Users2, label: "Estrutura de time" },
  { to: "/rituals", icon: CalendarCheck, label: "Rituais" },
  { to: "/maturity", icon: Gauge, label: "Maturidade" },
];

export default function Dashboard() {
  const { data: m } = useTenant();
  const tenantId = m?.tenant_id;

  const { data: maturity } = useQuery({
    queryKey: ["maturity", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await supabase.from("maturity_assessments").select("*")
        .eq("tenant_id", tenantId!).order("taken_at", { ascending: false });
      const latest: Record<string, number> = {};
      (data ?? []).forEach(a => { if (latest[a.dimension] === undefined) latest[a.dimension] = a.score; });
      return ["vision", "okrs", "rituals", "team", "financial"].map(d => ({
        dim: d === "vision" ? "Visão" : d === "okrs" ? "OKRs" : d === "rituals" ? "Rituais" : d === "team" ? "Time" : "Financeiro",
        score: latest[d] ?? 0,
      }));
    },
  });

  const overall = maturity?.length ? Math.round(maturity.reduce((a, x) => a + x.score, 0) / maturity.length) : 0;
  const tenantName = (m?.tenants as any)?.name ?? "Workspace";

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-accent font-semibold">Workspace</div>
          <h1 className="font-serif text-3xl md:text-4xl font-bold text-primary">{tenantName}</h1>
          <p className="text-muted-foreground mt-1">Seu plano estratégico vivo, em um só lugar.</p>
        </div>
        <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground shadow-gold">
          <Link to="/export"><FileDown className="h-4 w-4 mr-2" /> Exportar PDF</Link>
        </Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 shadow-soft">
          <CardHeader>
            <CardTitle className="font-serif">Maturidade geral</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-2">
              <div className="font-serif text-6xl font-bold text-primary">{overall}</div>
              <div className="text-sm text-muted-foreground mt-1">de 100</div>
            </div>
            <Button asChild variant="outline" size="sm" className="w-full mt-2">
              <Link to="/maturity">Ver recomendações <ArrowRight className="h-3 w-3 ml-1" /></Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2 shadow-soft">
          <CardHeader>
            <CardTitle className="font-serif">Radar por dimensão</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {(maturity ?? []).every(d => (d.score ?? 0) === 0) ? (
              <EmptyState
                icon={Gauge}
                title="Sem diagnóstico ainda"
                description="Faça seu diagnóstico 360 na plataforma para obter seu score de maturidade."
                ctaLabel="Fazer diagnóstico"
                ctaHref="https://mindful-interface-lab.lovable.app"
                density="sm"
              />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={maturity ?? []}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="dim" tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                  <Radar dataKey="score" stroke="hsl(var(--accent))" fill="hsl(var(--accent))" fillOpacity={0.35} />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="font-serif text-xl font-semibold text-primary mb-4">Atalhos</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {QUICK.map(({ to, icon: Icon, label }) => (
            <Link key={to} to={to} className="group bg-card border border-border rounded-xl p-5 shadow-soft hover:shadow-elegant hover:border-accent/40 transition-smooth flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/5 group-hover:bg-accent/10 flex items-center justify-center transition-smooth">
                <Icon className="h-5 w-5 text-primary group-hover:text-accent transition-smooth" />
              </div>
              <div className="flex-1 font-medium text-foreground">{label}</div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-accent group-hover:translate-x-0.5 transition-smooth" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
