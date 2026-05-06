import { useTenant } from "@/hooks/useTenant";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Inputs = { revenue: number; growth: number; margin: number; tax: number };
const SCENARIOS: { key: "optimistic" | "realistic" | "pessimistic"; label: string; multiplier: number; color: string }[] = [
  { key: "optimistic", label: "Otimista", multiplier: 1.3, color: "hsl(138 47% 32%)" },
  { key: "realistic", label: "Realista", multiplier: 1.0, color: "hsl(217 70% 14%)" },
  { key: "pessimistic", label: "Pessimista", multiplier: 0.7, color: "hsl(0 70% 45%)" },
];

function project(input: Inputs, years: number, mult: number) {
  const out: { year: string; revenue: number; opex: number; ebitda: number; net: number }[] = [];
  let rev = input.revenue;
  for (let y = 1; y <= years; y++) {
    rev = rev * (1 + (input.growth / 100) * mult);
    const ebitda = rev * (input.margin / 100);
    const tax = ebitda * (input.tax / 100);
    const net = ebitda - tax;
    const opex = rev - ebitda;
    out.push({ year: `Ano ${y}`, revenue: Math.round(rev), opex: Math.round(opex), ebitda: Math.round(ebitda), net: Math.round(net) });
  }
  return out;
}

const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export default function Financial() {
  const { data: m } = useTenant();
  const [inputs, setInputs] = useState<Inputs>({ revenue: 5000000, growth: 30, margin: 20, tax: 15 });

  const charts = SCENARIOS.map(s => ({ ...s, data: project(inputs, 5, s.multiplier) }));
  const combo = inputs && Array.from({ length: 5 }, (_, i) => ({
    year: `Ano ${i + 1}`,
    Otimista: charts[0].data[i].revenue,
    Realista: charts[1].data[i].revenue,
    Pessimista: charts[2].data[i].revenue,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <TrendingUp className="h-7 w-7 text-accent" />
        <div>
          <h1 className="font-serif text-3xl font-bold text-primary">Projeção financeira</h1>
          <p className="text-muted-foreground">DRE projetado em 3 cenários para 5 anos.</p>
        </div>
      </div>

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
              <Line type="monotone" dataKey="Otimista" stroke={SCENARIOS[0].color} strokeWidth={2} />
              <Line type="monotone" dataKey="Realista" stroke={SCENARIOS[1].color} strokeWidth={2.5} />
              <Line type="monotone" dataKey="Pessimista" stroke={SCENARIOS[2].color} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Tabs defaultValue="realistic">
        <TabsList>
          {SCENARIOS.map(s => <TabsTrigger key={s.key} value={s.key}>{s.label}</TabsTrigger>)}
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
