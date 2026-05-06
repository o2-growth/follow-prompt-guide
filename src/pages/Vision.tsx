import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Compass, Lightbulb } from "lucide-react";
import { AIInsightPanel } from "@/components/ai/AIInsightPanel";

const HORIZONS = [5, 3, 1] as const;

export default function Vision() {
  const { data: m } = useTenant();
  const tenantId = m?.tenant_id;
  const qc = useQueryClient();

  const { data: plans } = useQuery({
    queryKey: ["vision_plans", tenantId],
    enabled: !!tenantId,
    queryFn: async () => (await supabase.from("vision_plans").select("*").eq("tenant_id", tenantId!)).data ?? [],
  });

  const [drafts, setDrafts] = useState<Record<number, { north_star: string; mission: string; values: string }>>({});

  useEffect(() => {
    if (!plans) return;
    const d: typeof drafts = {};
    HORIZONS.forEach(h => {
      const p = plans.find(x => x.year_horizon === h);
      d[h] = {
        north_star: p?.north_star ?? "",
        mission: p?.mission ?? "",
        values: Array.isArray(p?.values_json) ? (p?.values_json as any[]).join(", ") : "",
      };
    });
    setDrafts(d);
  }, [plans]);

  const save = async (h: number) => {
    if (!tenantId) return;
    const d = drafts[h];
    const existing = plans?.find(p => p.year_horizon === h);
    const values_json = d.values.split(",").map(v => v.trim()).filter(Boolean);
    const payload = { north_star: d.north_star, mission: d.mission, values_json };
    if (existing) {
      await supabase.from("vision_plans").update(payload).eq("id", existing.id);
    } else {
      await supabase.from("vision_plans").insert({ tenant_id: tenantId, year_horizon: h, ...payload });
    }
    toast.success(`Visão ${h} ano${h > 1 ? "s" : ""} salva`);
    qc.invalidateQueries({ queryKey: ["vision_plans", tenantId] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Compass className="h-7 w-7 text-accent" />
        <div>
          <h1 className="font-serif text-3xl font-bold text-primary">Norte estratégico</h1>
          <p className="text-muted-foreground">North Star, missão e valores em 5 / 3 / 1 ano — amarrados às suas metas financeiras.</p>
        </div>
      </div>

      <AIInsightPanel
        surface="vision"
        title="Refino de Visão sugerido pela IA"
        description="A IA refina North Star, missão e valores em cada horizonte, conectando-os à meta financeira correspondente."
        applyAction={{
          label: "Aplicar visão sugerida",
          onApply: async (c) => {
            if (!tenantId) return;
            const map: Record<number, any> = { 5: c?.horizonte_5, 3: c?.horizonte_3, 1: c?.horizonte_1 };
            for (const h of HORIZONS) {
              const sug = map[h];
              if (!sug) continue;
              const existing = plans?.find(p => p.year_horizon === h);
              const payload = {
                north_star: sug.north_star ?? "",
                mission: sug.missao ?? "",
                values_json: Array.isArray(sug.valores) ? sug.valores : (existing?.values_json ?? []),
              };
              if (existing) await supabase.from("vision_plans").update(payload).eq("id", existing.id);
              else await supabase.from("vision_plans").insert({ tenant_id: tenantId, year_horizon: h, ...payload });
            }
            qc.invalidateQueries({ queryKey: ["vision_plans", tenantId] });
          },
        }}
        renderContent={(c) => (
          <div className="space-y-3">
            {c?.diagnostico && <p className="text-foreground/80 italic">{c.diagnostico}</p>}
            {([5,3,1] as const).map(h => {
              const k = h === 5 ? "horizonte_5" : h === 3 ? "horizonte_3" : "horizonte_1";
              const v = (c as any)?.[k];
              if (!v) return null;
              return (
                <div key={h} className="border-l-2 border-accent/50 pl-3 text-xs">
                  <div className="font-semibold text-primary">{h} ano{h>1?"s":""} · meta: <span className="text-accent">{v.meta_financeira}</span></div>
                  <div><span className="font-medium">North Star:</span> {v.north_star}</div>
                  <div><span className="font-medium">Missão:</span> {v.missao}</div>
                  {Array.isArray(v.valores) && v.valores.length > 0 && <div><span className="font-medium">Valores:</span> {v.valores.join(", ")}</div>}
                </div>
              );
            })}
          </div>
        )}
      />

      {plans !== undefined && plans.length === 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-accent/30 bg-accent/5 p-4">
          <Lightbulb className="h-5 w-5 text-accent shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-sm">
            <p className="font-medium text-primary">Comece pela visão de 5 anos.</p>
            <p className="text-muted-foreground mt-0.5">
              É o horizonte aspiracional. Depois, refine para 3 anos (direção) e 1 ano (execução).
              Cada salvamento é independente — não precisa preencher tudo de uma vez.
            </p>
          </div>
        </div>
      )}
      <div className="grid lg:grid-cols-3 gap-6">
        {HORIZONS.map(h => (
          <Card key={h} className="shadow-soft">
            <CardHeader>
              <CardTitle className="font-serif flex items-baseline justify-between">
                <span>{h} ano{h > 1 ? "s" : ""}</span>
                <span className="text-xs text-muted-foreground font-sans">{h === 5 ? "Aspiracional" : h === 3 ? "Direção" : "Execução"}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>North Star</Label>
                <Textarea rows={3} value={drafts[h]?.north_star ?? ""} onChange={e => setDrafts({ ...drafts, [h]: { ...drafts[h], north_star: e.target.value } })} placeholder="Onde queremos estar?" />
              </div>
              <div>
                <Label>Missão</Label>
                <Textarea rows={2} value={drafts[h]?.mission ?? ""} onChange={e => setDrafts({ ...drafts, [h]: { ...drafts[h], mission: e.target.value } })} />
              </div>
              <div>
                <Label>Valores (separe por vírgula)</Label>
                <Textarea rows={2} value={drafts[h]?.values ?? ""} onChange={e => setDrafts({ ...drafts, [h]: { ...drafts[h], values: e.target.value } })} placeholder="Excelência, transparência, foco no cliente" />
              </div>
              <Button onClick={() => save(h)} className="w-full">Salvar</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
