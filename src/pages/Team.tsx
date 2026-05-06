import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Users2 } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { useTenant } from "@/hooks/useTenant";
import { AIInsightPanel } from "@/components/ai/AIInsightPanel";

const AREAS = [
  { key: "commercial", label: "Comercial" },
  { key: "ops", label: "Operações" },
  { key: "finance", label: "Finanças" },
  { key: "product", label: "Produto" },
];

const REVENUE_BAND_TO_KEY = (band?: string | null): "<5M" | "5-20M" | ">20M" => {
  if (!band) return "<5M";
  if (band.includes("Acima") || band.includes("50M") || band.includes("200M")) return ">20M";
  if (band.includes("10M")) return "5-20M";
  return "<5M";
};

type Framework = {
  key: string;
  name: string;
  category: string;
  description_md: string | null;
  template_md: string | null;
  example_md: string | null;
  when_to_apply: string | null;
};

export default function Team() {
  const [area, setArea] = useState("commercial");
  const [activeFwKey, setActiveFwKey] = useState<string | null>(null);
  const { data: m } = useTenant();
  const revenueBandKey = REVENUE_BAND_TO_KEY((m?.tenants as any)?.revenue_band);

  const { data: roles = [] } = useQuery({
    queryKey: ["role_templates"],
    queryFn: async () => (await supabase.from("role_templates").select("*")).data ?? [],
  });

  const { data: frameworks = [] } = useQuery({
    queryKey: ["framework_library"],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("framework_library").select("*").order("display_order");
      if (error) throw error;
      return (data ?? []) as Framework[];
    },
  });

  const findFramework = (key: string) => (frameworks as Framework[]).find(f => f.key === key);
  const activeFramework = activeFwKey ? findFramework(activeFwKey) : null;

  const headcountFor = (r: any) => {
    const arr = Array.isArray(r.recommended_headcount_by_revenue) ? r.recommended_headcount_by_revenue : [];
    const rec = arr.find((x: any) => x.revenue_band === revenueBandKey);
    return rec ? rec.count : null;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Users2 className="h-7 w-7 text-accent" />
        <div>
          <h1 className="font-serif text-3xl font-bold text-primary">Estrutura de time</h1>
          <p className="text-muted-foreground">Organograma recomendado e frameworks por área.</p>
        </div>
      </div>

      <AIInsightPanel
        surface="team"
        title="Roadmap de contratações priorizado"
        description="A IA prioriza papéis para 0-6m, 6-12m e 12-24m com base nos gargalos que destravam sua meta financeira."
        renderContent={(c) => {
          const groups = ["0-6m","6-12m","12-24m"] as const;
          const labels: Record<string,string> = { "0-6m":"Próximos 6 meses","6-12m":"6 a 12 meses","12-24m":"12 a 24 meses" };
          const prioColor: Record<string,string> = { urgente:"text-destructive", alta:"text-accent", media:"text-foreground", baixa:"text-muted-foreground" };
          return (
            <div className="space-y-4">
              {c?.diagnostico && <p className="text-foreground/80 italic">{c.diagnostico}</p>}
              {groups.map(g => {
                const items = (c?.contratacoes ?? []).filter((x: any) => x.janela === g);
                if (!items.length) return null;
                return (
                  <div key={g}>
                    <div className="text-xs font-semibold uppercase tracking-wide text-accent mb-2">{labels[g]}</div>
                    <div className="space-y-2">
                      {items.map((it: any, i: number) => (
                        <div key={i} className="border-l-2 border-border pl-3 text-xs">
                          <div className="font-medium text-foreground">▸ {it.papel} <span className="text-muted-foreground">· {it.area} · {it.seniority}</span> <span className={`font-semibold ${prioColor[it.prioridade] ?? ""}`}>· {it.prioridade}</span></div>
                          <div className="text-muted-foreground">{it.por_que}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        }}
      />

      <Tabs value={area} onValueChange={setArea}>
        <TabsList>{AREAS.map(a => <TabsTrigger key={a.key} value={a.key}>{a.label}</TabsTrigger>)}</TabsList>
        {AREAS.map(a => (
          <TabsContent key={a.key} value={a.key} className="space-y-4 mt-4">
            {(roles as any[]).filter(r => r.area === a.key).map((r: any) => {
              const fwKeys = Array.isArray(r.framework_keys) ? r.framework_keys : (r.framework_key ? [r.framework_key] : []);
              const headcount = headcountFor(r);
              return (
                <Card key={r.id} className="shadow-soft">
                  <CardHeader>
                    <CardTitle className="font-serif flex items-baseline justify-between flex-wrap gap-2">
                      <span>{r.role_name}{r.seniority && <span className="ml-2 text-xs text-muted-foreground font-sans font-normal">· {r.seniority}</span>}</span>
                      <div className="flex flex-wrap gap-1.5">
                        {fwKeys.map((fk: string) => (
                          <button
                            key={fk}
                            onClick={() => setActiveFwKey(fk)}
                            className="text-xs px-2 py-0.5 rounded-full bg-secondary/15 text-secondary font-medium hover:bg-secondary/25 transition-smooth"
                          >
                            {fk}
                          </button>
                        ))}
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {r.description && <p>{r.description}</p>}
                    {r.framework_summary && (
                      <div className="text-muted-foreground border-l-2 border-accent/40 pl-3 italic">{r.framework_summary}</div>
                    )}
                    {headcount !== null && (
                      <div className="text-xs text-accent font-medium">
                        Headcount sugerido para faturamento {revenueBandKey}: <span className="font-bold">{headcount}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
            {!(roles as any[]).filter(r => r.area === a.key).length && (
              <EmptyState
                icon={Users2}
                title="Catálogo em construção"
                description="Em breve você verá aqui os papéis recomendados, frameworks (SPIN, MEDDIC, RACI) e descrições prontas para esta área."
              />
            )}
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={!!activeFwKey} onOpenChange={(o) => !o && setActiveFwKey(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif">
              {activeFramework?.name ?? activeFwKey}
              <span className="text-xs ml-2 font-normal text-muted-foreground">
                {activeFramework?.category}
              </span>
            </DialogTitle>
          </DialogHeader>
          {activeFramework ? (
            <div className="space-y-4 text-sm">
              {activeFramework.description_md && (
                <section>
                  <h4 className="font-semibold text-primary mb-1">O que é</h4>
                  <pre className="whitespace-pre-wrap font-sans text-foreground/90">{activeFramework.description_md}</pre>
                </section>
              )}
              {activeFramework.template_md && (
                <section>
                  <h4 className="font-semibold text-primary mb-1">Template</h4>
                  <pre className="whitespace-pre-wrap font-sans bg-muted/40 rounded-md p-3 text-foreground/90">{activeFramework.template_md}</pre>
                </section>
              )}
              {activeFramework.example_md && (
                <section>
                  <h4 className="font-semibold text-primary mb-1">Exemplo</h4>
                  <pre className="whitespace-pre-wrap font-sans bg-muted/40 rounded-md p-3 text-foreground/90">{activeFramework.example_md}</pre>
                </section>
              )}
              {activeFramework.when_to_apply && (
                <section>
                  <h4 className="font-semibold text-primary mb-1">Quando aplicar</h4>
                  <p className="text-foreground/90">{activeFramework.when_to_apply}</p>
                </section>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Framework não encontrado.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
