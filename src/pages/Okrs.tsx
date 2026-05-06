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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Target, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function Okrs() {
  const { user } = useAuth();
  const { data: m } = useTenant();
  const tenantId = m?.tenant_id;
  const qc = useQueryClient();

  const { data: objectives = [] } = useQuery({
    queryKey: ["objectives", tenantId],
    enabled: !!tenantId,
    queryFn: async () => (await supabase.from("okrs_objectives").select("*, key_results(*)").eq("tenant_id", tenantId!).order("created_at")).data ?? [],
  });

  const [newObj, setNewObj] = useState({ title: "", description: "", quarter: "" });
  const addObjective = async () => {
    if (!tenantId || !newObj.title) return;
    await supabase.from("okrs_objectives").insert({ tenant_id: tenantId, owner_id: user!.id, level: "company", ...newObj });
    setNewObj({ title: "", description: "", quarter: "" });
    qc.invalidateQueries({ queryKey: ["objectives", tenantId] });
    toast.success("Objetivo criado");
  };

  const addKR = async (objective_id: string, title: string, target: number) => {
    if (!tenantId) return;
    await supabase.from("key_results").insert({ tenant_id: tenantId, objective_id, title, target, current: 0, unit: "%" });
    qc.invalidateQueries({ queryKey: ["objectives", tenantId] });
  };

  const updateKR = async (id: string, current: number) => {
    await supabase.from("key_results").update({ current }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["objectives", tenantId] });
  };

  const removeObj = async (id: string) => {
    await supabase.from("okrs_objectives").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["objectives", tenantId] });
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

      <Card className="shadow-soft">
        <CardHeader><CardTitle className="font-serif text-lg">Novo objetivo</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2"><Input placeholder="Ex.: Triplicar receita em 2026" value={newObj.title} onChange={e => setNewObj({ ...newObj, title: e.target.value })} /></div>
            <div><Input placeholder="Q1 2026" value={newObj.quarter} onChange={e => setNewObj({ ...newObj, quarter: e.target.value })} /></div>
          </div>
          <Textarea rows={2} placeholder="Descrição (opcional)" value={newObj.description} onChange={e => setNewObj({ ...newObj, description: e.target.value })} />
          <Button onClick={addObjective}><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {objectives.map((o: any) => {
          const krs = o.key_results ?? [];
          const avg = krs.length ? Math.round(krs.reduce((a: number, k: any) => a + (k.target ? (k.current / k.target) * 100 : 0), 0) / krs.length) : 0;
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
                    return (
                      <div key={kr.id} className="border border-border rounded-lg p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 text-sm font-medium">{kr.title}</div>
                          <div className="flex items-center gap-2 text-xs">
                            <Input type="number" value={kr.current ?? 0} onChange={e => updateKR(kr.id, Number(e.target.value))} className="w-20 h-8" />
                            <span className="text-muted-foreground">/ {kr.target} {kr.unit}</span>
                          </div>
                        </div>
                        <Progress value={pct} className="mt-2 h-1.5" />
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
          <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-border rounded-xl">
            Nenhum objetivo ainda. Crie o primeiro acima.
          </div>
        )}
      </div>
    </div>
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
