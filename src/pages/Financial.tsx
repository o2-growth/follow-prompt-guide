import { useTenant } from "@/hooks/useTenant";
import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TrendingUp, CheckCircle2, Loader2 } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { captureError } from "@/lib/sentry";
import { AIInsightPanel } from "@/components/ai/AIInsightPanel";

type Inputs = { revenue: number; growth: number; margin: number; tax: number };
type ScenarioKey = "optimistic" | "realistic" | "pessimistic";

const SCENARIO_META: { key: ScenarioKey; label: string; multiplier: number; color: string }[] = [
  { key: "optimistic", label: "Otimista", multiplier: 1.3, color: "hsl(138 47% 32%)" },
  { key: "realistic", label: "Realista", multiplier: 1.0, color: "hsl(217 70% 14%)" },
  { key: "pessimistic", label: "Pessimista", multiplier: 0.7, color: "hsl(0 70% 45%)" },
];

const HORIZON = 5;
const VIEW_HORIZONS = [1, 3, 5] as const;
const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function project(input: Inputs, years: number, mult: number) {
  const out: { year: string; year_num: number; revenue: number; opex: number; ebitda: number; net: number }[] = [];
  let rev = input.revenue;
  for (let y = 1; y <= years; y++) {
    rev = rev * (1 + (input.growth / 100) * mult);
    const ebitda = rev * (input.margin / 100);
    const tax = ebitda * (input.tax / 100);
    const net = ebitda - tax;
    const opex = rev - ebitda;
    out.push({
      year: `Ano ${y}`,
      year_num: y,
      revenue: Math.round(rev),
      opex: Math.round(opex),
      ebitda: Math.round(ebitda),
      net: Math.round(net),
    });
  }
  return out;
}

export default function Financial() {
  const { data: m } = useTenant();
  const tenantId = m?.tenant_id;
  const qc = useQueryClient();

  // Frente 7: persistência via Supabase.
  const { data: projections, isLoading } = useQuery({
    queryKey: ["financial-projections", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_projections")
        .select("*")
        .eq("tenant_id", tenantId!);
      if (error) throw error;
      // Se não existem cenários, inicializa via RPC.
      if (!data || data.length === 0) {
        await (supabase.rpc as any)("init_projections", {
          p_tenant_id: tenantId,
          p_horizon_years: HORIZON,
        });
        const { data: refetched } = await supabase
          .from("financial_projections")
          .select("*")
          .eq("tenant_id", tenantId!);
        return refetched ?? [];
      }
      return data;
    },
  });

  // Inputs base = scenario "realistic". Os 3 cenários derivam por multiplier.
  const realisticRow = useMemo(
    () => (projections ?? []).find(p => p.scenario === "realistic" && p.horizon_years === HORIZON),
    [projections]
  );

  const [inputs, setInputs] = useState<Inputs>({ revenue: 5000000, growth: 30, margin: 20, tax: 15 });
  const [viewHorizon, setViewHorizon] = useState<1 | 3 | 5>(5);
  const [hydrated, setHydrated] = useState(false);
  const [savingState, setSavingState] = useState<"idle" | "saving" | "saved">("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hidrata do DB uma vez quando carrega.
  useEffect(() => {
    if (!realisticRow || hydrated) return;
    const ij = (realisticRow.inputs_json as any) ?? {};
    setInputs({
      revenue: typeof ij.revenue_year1 === "number" ? ij.revenue_year1 : (ij.revenue ?? 5000000),
      growth: typeof ij.growth_rate === "number" ? Math.round(ij.growth_rate * 100) : (ij.growth ?? 30),
      margin: typeof ij.ebitda_margin === "number" ? Math.round(ij.ebitda_margin * 100) : (ij.margin ?? 20),
      tax: typeof ij.effective_tax === "number" ? Math.round(ij.effective_tax * 100) : (ij.tax ?? 15),
    });
    setHydrated(true);
  }, [realisticRow, hydrated]);

  const charts = SCENARIO_META.map(s => ({ ...s, data: project(inputs, HORIZON, s.multiplier).slice(0, viewHorizon) }));
  const combo = Array.from({ length: viewHorizon }, (_, i) => ({
    year: `Ano ${i + 1}`,
    Otimista: charts[0].data[i].revenue,
    Realista: charts[1].data[i].revenue,
    Pessimista: charts[2].data[i].revenue,
  }));

  // Autosave com debounce de 500ms (após hidratação)
  useEffect(() => {
    if (!tenantId || !hydrated || !projections) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSavingState("saving");
      try {
        // 1. Atualiza inputs_json em todas 3 rows (cada uma com seu multiplier).
        const updates = SCENARIO_META.map(s => {
          const row = (projections ?? []).find(p => p.scenario === s.key && p.horizon_years === HORIZON);
          const inputs_json = {
            revenue_year1: inputs.revenue,
            growth_rate: (inputs.growth / 100) * s.multiplier,
            ebitda_margin: inputs.margin / 100,
            effective_tax: inputs.tax / 100,
            base_inputs: inputs,
            scenario_multiplier: s.multiplier,
          };
          return { row, scenario: s.key, inputs_json, multiplier: s.multiplier };
        });

        for (const u of updates) {
          if (u.row) {
            const { error } = await supabase
              .from("financial_projections")
              .update({ inputs_json: u.inputs_json })
              .eq("id", u.row.id);
            if (error) throw error;
          } else {
            const { error } = await supabase.from("financial_projections").insert({
              tenant_id: tenantId,
              scenario: u.scenario,
              horizon_years: HORIZON,
              inputs_json: u.inputs_json,
            });
            if (error) throw error;
          }
        }

        // 2. Persiste DRE em dre_line_items (uma row por scenario × year × label).
        // Refaz query pra pegar IDs (caso scenario tenha sido recém criado).
        const { data: refreshed } = await supabase
          .from("financial_projections")
          .select("*")
          .eq("tenant_id", tenantId);
        const projById = new Map<string, string>(); // scenario -> id
        for (const p of refreshed ?? []) {
          if (p.horizon_years === HORIZON) projById.set(p.scenario, p.id);
        }

        const lineRows: any[] = [];
        for (const s of SCENARIO_META) {
          const projId = projById.get(s.key);
          if (!projId) continue;
          const data = project(inputs, HORIZON, s.multiplier);
          for (const d of data) {
            lineRows.push({ projection_id: projId, tenant_id: tenantId, year: d.year_num, label: "Receita",   category: "revenue", amount: d.revenue });
            lineRows.push({ projection_id: projId, tenant_id: tenantId, year: d.year_num, label: "OPEX",      category: "opex",    amount: d.opex });
            lineRows.push({ projection_id: projId, tenant_id: tenantId, year: d.year_num, label: "EBITDA",    category: "ebitda",  amount: d.ebitda });
            lineRows.push({ projection_id: projId, tenant_id: tenantId, year: d.year_num, label: "Lucro líquido", category: "net", amount: d.net });
          }
        }

        if (lineRows.length > 0) {
          // Não há UNIQUE em dre_line_items, então fazemos delete+insert por projection_id.
          const projIds = Array.from(projById.values());
          if (projIds.length > 0) {
            await supabase.from("dre_line_items").delete().in("projection_id", projIds);
          }
          // Insert em lotes de até 100 pra evitar payload gigante.
          for (let i = 0; i < lineRows.length; i += 100) {
            const chunk = lineRows.slice(i, i + 100);
            const { error } = await supabase.from("dre_line_items").insert(chunk);
            if (error) throw error;
          }
        }

        qc.invalidateQueries({ queryKey: ["financial-projections", tenantId] });
        setSavingState("saved");
        setTimeout(() => setSavingState("idle"), 1500);
      } catch (e) {
        captureError(e, { step: "Financial autosave" });
        setSavingState("idle");
      }
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputs, tenantId, hydrated]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-7 w-7 text-accent" />
          <div>
            <h1 className="font-serif text-3xl font-bold text-primary">Projeção financeira</h1>
            <p className="text-muted-foreground">DRE projetado em 3 cenários — visualize 1, 3 ou 5 anos.</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg">
            {VIEW_HORIZONS.map(h => (
              <button
                key={h}
                onClick={() => setViewHorizon(h)}
                className={`text-xs px-3 py-1 rounded-md font-medium transition-smooth ${viewHorizon === h ? "bg-primary text-primary-foreground shadow-soft" : "text-muted-foreground hover:text-foreground"}`}
              >
                {h} ano{h > 1 ? "s" : ""}
              </button>
            ))}
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            {savingState === "saving" && <><Loader2 className="h-3 w-3 animate-spin" /> Salvando…</>}
            {savingState === "saved" && <><CheckCircle2 className="h-3 w-3 text-secondary" /> Salvo</>}
          </div>
        </div>
      </div>

      <AIInsightPanel
        surface="financial"
        title="Leitura crítica das premissas"
        description="A IA analisa se suas premissas são realistas para o setor e sugere o cenário ideal para 1, 3 e 5 anos."
        renderContent={(c) => (
          <div className="space-y-3 text-xs">
            {c?.diagnostico && <p className="text-foreground/80 italic text-sm">{c.diagnostico}</p>}
            {Array.isArray(c?.riscos) && c.riscos.length > 0 && (
              <div><span className="font-semibold text-destructive">Riscos:</span> {c.riscos.join(" · ")}</div>
            )}
            {Array.isArray(c?.alavancas) && c.alavancas.length > 0 && (
              <div><span className="font-semibold text-secondary">Alavancas:</span> {c.alavancas.join(" · ")}</div>
            )}
            {c?.cenario_ideal && (
              <div className="grid sm:grid-cols-3 gap-2 mt-2">
                {(["ano_1","ano_3","ano_5"] as const).map((k, i) => {
                  const v = c.cenario_ideal[k];
                  if (!v) return null;
                  const label = ["1 ano","3 anos","5 anos"][i];
                  return (
                    <div key={k} className="border border-accent/30 bg-card rounded-lg p-2">
                      <div className="font-semibold text-primary">{label}</div>
                      <div>Receita: <span className="text-accent font-medium">{v.receita_meta}</span></div>
                      <div>Margem: {v.margem_alvo}</div>
                      <div className="text-muted-foreground">{v.foco}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      />


      <Card className="shadow-soft">
        <CardHeader><CardTitle className="font-serif text-lg">Premissas</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-4 gap-4">
          <div><Label>Receita atual (R$)</Label><Input type="number" value={inputs.revenue} onChange={e => setInputs({ ...inputs, revenue: Number(e.target.value) })} /></div>
          <div><Label>Crescimento anual (%)</Label><Input type="number" value={inputs.growth} onChange={e => setInputs({ ...inputs, growth: Number(e.target.value) })} /></div>
          <div><Label>Margem EBITDA (%)</Label><Input type="number" value={inputs.margin} onChange={e => setInputs({ ...inputs, margin: Number(e.target.value) })} /></div>
          <div><Label>Imposto sobre lucro (%)</Label><Input type="number" value={inputs.tax} onChange={e => setInputs({ ...inputs, tax: Number(e.target.value) })} /></div>
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardHeader><CardTitle className="font-serif text-lg">Receita por cenário</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={combo}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
              <XAxis dataKey="year" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickFormatter={v => `R$${(v/1e6).toFixed(1)}M`} />
              <Tooltip formatter={(v: any) => fmt(Number(v))} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              <Legend />
              <Line type="monotone" dataKey="Otimista" stroke={SCENARIO_META[0].color} strokeWidth={2} />
              <Line type="monotone" dataKey="Realista" stroke={SCENARIO_META[1].color} strokeWidth={2.5} />
              <Line type="monotone" dataKey="Pessimista" stroke={SCENARIO_META[2].color} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Tabs defaultValue="realistic">
        <TabsList>
          {SCENARIO_META.map(s => <TabsTrigger key={s.key} value={s.key}>{s.label}</TabsTrigger>)}
        </TabsList>
        {charts.map(c => (
          <TabsContent key={c.key} value={c.key}>
            <Card className="shadow-soft">
              <CardHeader><CardTitle className="font-serif text-lg">DRE — {c.label}</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-muted-foreground">
                        <th className="py-2 pr-4">Linha</th>
                        {c.data.map(d => <th key={d.year} className="py-2 px-3 text-right">{d.year}</th>)}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      <tr><td className="py-2 pr-4 font-medium">Receita</td>{c.data.map(d => <td key={d.year} className="py-2 px-3 text-right">{fmt(d.revenue)}</td>)}</tr>
                      <tr><td className="py-2 pr-4 text-muted-foreground">(–) OPEX</td>{c.data.map(d => <td key={d.year} className="py-2 px-3 text-right">{fmt(d.opex)}</td>)}</tr>
                      <tr><td className="py-2 pr-4 font-medium">EBITDA</td>{c.data.map(d => <td key={d.year} className="py-2 px-3 text-right">{fmt(d.ebitda)}</td>)}</tr>
                      <tr><td className="py-2 pr-4 font-semibold text-secondary">Lucro líquido</td>{c.data.map(d => <td key={d.year} className="py-2 px-3 text-right font-semibold text-secondary">{fmt(d.net)}</td>)}</tr>
                    </tbody>
                  </table>
                </div>
                <div className="mt-6 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={c.data}>
                      <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                      <XAxis dataKey="year" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                      <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickFormatter={v => `R$${(v/1e6).toFixed(1)}M`} />
                      <Tooltip formatter={(v: any) => fmt(Number(v))} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                      <Bar dataKey="revenue" name="Receita" fill={c.color} />
                      <Bar dataKey="net" name="Lucro líquido" fill="hsl(var(--accent))" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
