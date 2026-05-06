import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { CalendarCheck } from "lucide-react";
import { toast } from "sonner";

const TEMPLATES: { kind: "daily" | "weekly" | "monthly" | "quarter" | "one_on_one"; name: string; cadence: string; agenda: string[] }[] = [
  { kind: "daily", name: "Daily 15min", cadence: "0 9 * * 1-5", agenda: ["O que fiz ontem", "O que farei hoje", "Bloqueios"] },
  { kind: "weekly", name: "Weekly 1h", cadence: "0 9 * * 1", agenda: ["Revisão de KRs", "Riscos e bloqueios", "Decisões da semana"] },
  { kind: "one_on_one", name: "1:1 quinzenal (45min)", cadence: "0 14 * * 3", agenda: ["Como você está?", "Progresso de carreira", "Feedback bidirecional"] },
  { kind: "monthly", name: "Monthly review (1h30)", cadence: "0 10 1 * *", agenda: ["Resultados do mês", "Aprendizados", "Ajustes de plano"] },
  { kind: "quarter", name: "Quarter review (4h)", cadence: "0 9 1 1,4,7,10 *", agenda: ["Score dos OKRs", "Revisão da estratégia", "OKRs próximos 90 dias"] },
];

export default function Rituals() {
  const { data: m } = useTenant();
  const tenantId = m?.tenant_id;
  const qc = useQueryClient();

  const { data: rituals = [] } = useQuery({
    queryKey: ["rituals", tenantId],
    enabled: !!tenantId,
    queryFn: async () => (await supabase.from("rituals").select("*").eq("tenant_id", tenantId!)).data ?? [],
  });

  const isActive = (kind: string) => rituals.some(r => r.kind === kind && r.active);

  const toggle = async (tpl: typeof TEMPLATES[number], on: boolean) => {
    if (!tenantId) return;
    const existing = rituals.find(r => r.kind === tpl.kind);
    if (existing) {
      await supabase.from("rituals").update({ active: on }).eq("id", existing.id);
    } else if (on) {
      await supabase.from("rituals").insert({
        tenant_id: tenantId, kind: tpl.kind, name: tpl.name, cadence_cron: tpl.cadence,
        agenda_json: tpl.agenda, active: true,
      });
    }
    toast.success(on ? "Ritual ativado" : "Ritual desativado");
    qc.invalidateQueries({ queryKey: ["rituals", tenantId] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <CalendarCheck className="h-7 w-7 text-accent" />
        <div>
          <h1 className="font-serif text-3xl font-bold text-primary">Rituais</h1>
          <p className="text-muted-foreground">Ative os rituais que sua empresa vai praticar.</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {TEMPLATES.map(t => {
          const active = isActive(t.kind);
          return (
            <Card key={t.kind} className="shadow-soft">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="font-serif text-lg">{t.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`s-${t.kind}`} className="text-xs text-muted-foreground">Ativar</Label>
                    <Switch id={`s-${t.kind}`} checked={active} onCheckedChange={v => toggle(t, v)} />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Agenda sugerida</div>
                <ul className="space-y-1.5 text-sm">
                  {t.agenda.map((a, i) => (
                    <li key={i} className="flex gap-2"><span className="text-accent">•</span>{a}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
