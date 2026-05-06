import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { CalendarCheck, Plus, Target, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { EmptyState } from "@/components/common/EmptyState";
import { captureError } from "@/lib/sentry";
import { AIInsightPanel } from "@/components/ai/AIInsightPanel";

const QUARTERS = ["Q1 2026", "Q2 2026", "Q3 2026", "Q4 2026", "Q1 2027"];

export default function Okrs() {
  const { user } = useAuth();
  const { data: m } = useTenant();
  const tenantId = m?.tenant_id;
  const qc = useQueryClient();

  const { data: objectives = [] } = useQuery({
    queryKey: ["objectives", tenantId],
    enabled: !!tenantId,
    queryFn: async () =>
      (await supabase
        .from("okrs_objectives")
        .select("*, key_results(*)")
        .eq("tenant_id", tenantId!)
        .order("created_at")).data ?? [],
  });

  const krIds = (objectives as any[]).flatMap(o => (o.key_results ?? []).map((k: any) => k.id));
  const { data: checkins = [] } = useQuery({
    queryKey: ["okr-checkins", tenantId, krIds.join(",")],
    enabled: !!tenantId && krIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("okr_check_ins")
        .select("*")
        .in("key_result_id", krIds)
        .order("week", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const [newObj, setNewObj] = useState({ title: "", description: "", quarter: QUARTERS[0] });

  const addObjective = async () => {
    if (!tenantId || !newObj.title || !user) return;
    const { error } = await supabase.from("okrs_objectives").insert({
      tenant_id: tenantId, owner_id: user.id, level: "company", ...newObj,
    });
    if (error) {
      captureError(error, { step: "addObjective" });
      toast.error(error.message ?? "Erro ao criar objetivo");
      return;
    }
    setNewObj({ title: "", description: "", quarter: QUARTERS[0] });
    qc.invalidateQueries({ queryKey: ["objectives", tenantId] });
    try {
      await (supabase.rpc as any)("log_event", {
        p_tenant_id: tenantId,
        p_action: "okr_created",
        p_entity_type: "okrs_objectives",
        p_entity_id: null,
        p_payload: { title: newObj.title, quarter: newObj.quarter },
      });
    } catch (e) {
      captureError(e, { step: "log_event okr_created" });
    }
    toast.success("Objetivo criado");
  };

  const addKR = async (objective_id: string, title: string, target: number) => {
    if (!tenantId) return;
    await supabase.from("key_results").insert({ tenant_id: tenantId, objective_id, title, target, current: 0, unit: "%" });
    qc.invalidateQueries({ queryKey: ["objectives", tenantId] });
  };

  const removeObj = async (id: string) => {
    await supabase.from("okrs_objectives").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["objectives", tenantId] });
  };

  const submitCheckin = async (kr: any, value: number, confidence: number, note: string) => {
    if (!tenantId) return;
    try {
      // Trava a "semana" no monday corrente (ISO week start) pra evitar duplicar.
      const today = new Date();
      const day = (today.getUTCDay() + 6) % 7;
      const monday = new Date(today);
      monday.setUTCDate(today.getUTCDate() - day);
      const weekISODate = monday.toISOString().slice(0, 10);

      const { error: insErr } = await supabase.from("okr_check_ins").insert({
        tenant_id: tenantId,
        key_result_id: kr.id,
        week: weekISODate,
        value,
        confidence,
        note,
      });
      if (insErr) throw insErr;
      const { error: updErr } = await supabase.from("key_results").update({ current: value }).eq("id", kr.id);
      if (updErr) throw updErr;
      qc.invalidateQueries({ queryKey: ["objectives", tenantId] });
      qc.invalidateQueries({ queryKey: ["okr-checkins", tenantId] });
      toast.success("Check-in salvo");
    } catch (e: any) {
      captureError(e, { step: "submitCheckin" });
      toast.error(e?.message ?? "Erro ao salvar check-in");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Target className="h-7 w-7 text-accent" />
        <div>
          <h1 className="font-serif text-3xl font-bold text-primary">OKRs</h1>
          <p className="text-muted-foreground">Objetivos e Key Results da empresa.</p>
        </div>
      </div>

      <AIInsightPanel
        surface="okrs"
        title="OKRs sugeridos pela IA"
        description="A IA sugere 3 objetivos trimestrais com KRs mensuráveis e KPIs de acompanhamento, conectados à sua meta financeira."
        applyAction={{
          label: "Criar OKRs sugeridos",
          onApply: async (c) => {
            if (!tenantId || !user) return;
            for (const o of (c?.objetivos ?? []) as any[]) {
              const { data: obj, error } = await supabase
                .from("okrs_objectives")
                .insert({ tenant_id: tenantId, owner_id: user.id, level: "company", title: o.titulo, description: o.por_que, quarter: QUARTERS[0] })
                .select()
                .single();
              if (error || !obj) continue;
              for (const kr of (o.key_results ?? []) as any[]) {
                const num = parseFloat(String(kr.meta).replace(/[^\d.]/g, "")) || 100;
                await supabase.from("key_results").insert({
                  tenant_id: tenantId, objective_id: obj.id, title: kr.kr, target: num, current: 0, unit: kr.kpi_acompanhamento ?? "",
                });
              }
            }
            qc.invalidateQueries({ queryKey: ["objectives", tenantId] });
          },
        }}
        renderContent={(c) => (
          <div className="space-y-4">
            {c?.diagnostico && <p className="text-foreground/80 italic">{c.diagnostico}</p>}
            {(c?.objetivos ?? []).map((o: any, i: number) => (
              <div key={i} className="border-l-2 border-accent/50 pl-3">
                <div className="font-semibold text-primary">◆ {o.titulo}</div>
                <div className="text-xs text-muted-foreground mb-2">{o.por_que}</div>
                <ul className="space-y-1">
                  {(o.key_results ?? []).map((kr: any, j: number) => (
                    <li key={j} className="text-xs">
                      <span className="font-medium">• {kr.kr}</span>
                      <div className="text-muted-foreground pl-3">Meta: {kr.meta}{kr.baseline ? ` · Baseline: ${kr.baseline}` : ""} · KPI: {kr.kpi_acompanhamento}</div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      />

      <Card className="shadow-soft">
        <CardHeader><CardTitle className="font-serif text-lg">Novo objetivo</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <Input placeholder="Ex.: Triplicar receita em 2026" value={newObj.title} onChange={e => setNewObj({ ...newObj, title: e.target.value })} />
            </div>
            <div>
              <Select value={newObj.quarter} onValueChange={v => setNewObj({ ...newObj, quarter: v })}>
                <SelectTrigger><SelectValue placeholder="Trimestre" /></SelectTrigger>
                <SelectContent>{QUARTERS.map(q => <SelectItem key={q} value={q}>{q}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <Textarea rows={2} placeholder="Descrição (opcional)" value={newObj.description} onChange={e => setNewObj({ ...newObj, description: e.target.value })} />
          <Button onClick={addObjective}><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {(objectives as any[]).map((o: any) => {
          const krs = (o.key_results ?? []) as any[];
          const avg = krs.length
            ? Math.round(krs.reduce((a, k) => a + (k.target ? (k.current / k.target) * 100 : 0), 0) / krs.length)
            : 0;
          return (
            <Card key={o.id} className="shadow-soft">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="font-serif">{o.title}</CardTitle>
                    {o.description && <p className="text-sm text-muted-foreground mt-1">{o.description}</p>}
                    {o.quarter && <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full bg-accent/15 text-accent font-medium">{o.quarter}</span>}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeObj(o.id)}><Trash2 className="h-4 w-4 text-muted-foreground" /></Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1"><span>Progresso geral</span><span className="font-medium">{avg}%</span></div>
                  <Progress value={avg} />
                </div>
                <div className="space-y-2">
                  {krs.map((kr: any) => {
                    const pct = kr.target ? Math.round((kr.current / kr.target) * 100) : 0;
                    const krCheckins = (checkins as any[]).filter(c => c.key_result_id === kr.id).slice(0, 4);
                    return (
                      <div key={kr.id} className="border border-border rounded-lg p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 text-sm font-medium">{kr.title}</div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground">
                              {kr.current ?? 0} / {kr.target} {kr.unit}
                            </span>
                            <CheckinDialog kr={kr} onSubmit={submitCheckin} />
                          </div>
                        </div>
                        <Progress value={pct} className="mt-2 h-1.5" />
                        {krCheckins.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                            {krCheckins.map((c: any) => {
                              const d = new Date(c.week);
                              const week = `Sem ${getISOWeek(d)}`;
                              const pctC = kr.target ? Math.round(((c.value ?? 0) / kr.target) * 100) : 0;
                              return (
                                <span key={c.id} className="border border-border rounded px-2 py-0.5">
                                  {week} · {pctC}% · {c.confidence ?? "—"}/10
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <AddKRDialog onAdd={(t, target) => addKR(o.id, t, target)} />
              </CardContent>
            </Card>
          );
        })}
        {!objectives.length && (
          <EmptyState
            icon={Target}
            title="Defina seu primeiro objetivo"
            description="Objetivos ambiciosos guiam a execução. Use o formulário acima para criar um objetivo trimestral e adicione 2 a 4 Key Results mensuráveis."
          />
        )}
      </div>
    </div>
  );
}

function getISOWeek(date: Date) {
  const target = new Date(date.valueOf());
  const dayNr = (date.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const diff = (target.getTime() - firstThursday.getTime()) / 86400000;
  return 1 + Math.round((diff - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
}

function CheckinDialog({
  kr,
  onSubmit,
}: {
  kr: any;
  onSubmit: (kr: any, value: number, confidence: number, note: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<number>(kr.current ?? 0);
  const [confidence, setConfidence] = useState<number>(7);
  const [note, setNote] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-8">
          <CalendarCheck className="h-3.5 w-3.5 mr-1" /> Check-in
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif">Check-in semanal — {kr.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label>Valor atual ({kr.unit ?? ""})</Label>
            <Input type="number" value={value} onChange={e => setValue(Number(e.target.value))} />
            <p className="text-xs text-muted-foreground mt-1">Meta: {kr.target} {kr.unit}</p>
          </div>
          <div>
            <Label>Confiança em atingir a meta: {confidence}/10</Label>
            <Slider
              min={1}
              max={10}
              step={1}
              value={[confidence]}
              onValueChange={v => setConfidence(v[0] ?? 7)}
              className="mt-2"
            />
          </div>
          <div>
            <Label>Nota</Label>
            <Textarea
              rows={3}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Ex.: Pipeline cresceu 12%, mas ciclo médio aumentou. Bloqueio: time SDR sem head."
            />
          </div>
          <Button
            onClick={() => {
              onSubmit(kr, value, confidence, note);
              setOpen(false);
              setNote("");
            }}
          >
            Salvar check-in
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddKRDialog({ onAdd }: { onAdd: (title: string, target: number) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState(100);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Plus className="h-3 w-3 mr-1" /> Adicionar Key Result</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-serif">Novo Key Result</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Título</Label><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex.: Atingir 200 contratos" /></div>
          <div><Label>Meta numérica</Label><Input type="number" value={target} onChange={e => setTarget(Number(e.target.value))} /></div>
          <Button onClick={() => { if (title) { onAdd(title, target); setTitle(""); setTarget(100); setOpen(false); } }}>Adicionar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
