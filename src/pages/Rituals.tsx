import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { CalendarCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

type RitualKind = "daily" | "weekly" | "monthly" | "quarter" | "one_on_one";

type RitualTemplate = {
  id: string;
  kind: RitualKind;
  name: string;
  cadence_cron: string | null;
  duration_minutes: number | null;
  agenda_json: Array<{ item: string; minutes?: number }> | string[];
  description: string | null;
  display_order: number;
};

export default function Rituals() {
  const { data: m } = useTenant();
  const tenantId = m?.tenant_id;
  const qc = useQueryClient();

  // Frente 9 / I7: lê templates globais da tabela ritual_templates.
  const { data: templates = [], isLoading: loadingTpl } = useQuery({
    queryKey: ["ritual-templates"],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("ritual_templates")
        .select("*")
        .order("display_order");
      if (error) throw error;
      return (data ?? []) as RitualTemplate[];
    },
  });

  const { data: rituals = [] } = useQuery({
    queryKey: ["rituals", tenantId],
    enabled: !!tenantId,
    queryFn: async () =>
      (await supabase.from("rituals").select("*").eq("tenant_id", tenantId!)).data ?? [],
  });

  const isActive = (kind: string) => (rituals as any[]).some(r => r.kind === kind && r.active);

  const toggle = async (tpl: RitualTemplate, on: boolean) => {
    if (!tenantId) return;
    const existing = (rituals as any[]).find(r => r.kind === tpl.kind);
    if (existing) {
      await supabase.from("rituals").update({ active: on }).eq("id", existing.id);
    } else if (on) {
      await supabase.from("rituals").insert({
        tenant_id: tenantId,
        kind: tpl.kind,
        name: tpl.name,
        cadence_cron: tpl.cadence_cron,
        agenda_json: tpl.agenda_json as any,
        active: true,
      });
    }
    toast.success(on ? "Ritual ativado" : "Ritual desativado");
    qc.invalidateQueries({ queryKey: ["rituals", tenantId] });
  };

  const renderAgendaItem = (item: any) => (typeof item === "string" ? item : item?.item ?? "");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <CalendarCheck className="h-7 w-7 text-accent" />
        <div>
          <h1 className="font-serif text-3xl font-bold text-primary">Rituais</h1>
          <p className="text-muted-foreground">Ative os rituais que sua empresa vai praticar.</p>
        </div>
      </div>

      {loadingTpl ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {templates.map(t => {
            const active = isActive(t.kind);
            return (
              <Card key={t.id} className="shadow-soft">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="font-serif text-lg">{t.name}</CardTitle>
                      {t.description && (
                        <p className="text-xs text-muted-foreground mt-1">{t.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Label htmlFor={`s-${t.id}`} className="text-xs text-muted-foreground">Ativar</Label>
                      <Switch id={`s-${t.id}`} checked={active} onCheckedChange={v => toggle(t, v)} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Agenda sugerida</div>
                  <ul className="space-y-1.5 text-sm">
                    {(Array.isArray(t.agenda_json) ? t.agenda_json : []).map((a: any, i: number) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-accent">•</span>
                        <span>{renderAgendaItem(a)}</span>
                        {typeof a === "object" && a?.minutes && (
                          <span className="text-muted-foreground/70 text-xs">· {a.minutes}min</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
