import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Loader2, ArrowRight, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const SECTORS = ["Serviços B2B", "Serviços B2C", "Indústria", "Varejo", "Tecnologia/SaaS", "Saúde", "Educação", "Construção", "Agro", "Outro"];
const SIZE = ["1–10", "11–50", "51–200", "201–500", "500+"];
const REVENUE = ["Até R$ 1M", "R$ 1M – 10M", "R$ 10M – 50M", "R$ 50M – 200M", "Acima de R$ 200M"];

const QUESTIONS = [
  { dim: "vision", q: "Sua empresa tem uma visão de 3–5 anos escrita e comunicada?" },
  { dim: "vision", q: "As metas anuais derivam diretamente dessa visão?" },
  { dim: "vision", q: "Os colaboradores conseguem citar a missão e os valores?" },
  { dim: "okrs", q: "Existem OKRs trimestrais com KRs mensuráveis?" },
  { dim: "okrs", q: "Há check-ins regulares de progresso dos OKRs?" },
  { dim: "okrs", q: "Os OKRs estão cascateados por área/time?" },
  { dim: "rituals", q: "Há ritual semanal de acompanhamento (weekly)?" },
  { dim: "rituals", q: "Existem 1:1 estruturados com os líderes?" },
  { dim: "rituals", q: "Há quarter review com decisões formalizadas?" },
  { dim: "team", q: "O organograma das áreas-chave está definido?" },
  { dim: "team", q: "Cada papel-chave tem responsabilidades claras (RACI)?" },
  { dim: "team", q: "O time comercial usa metodologia (SPIN/MEDDIC)?" },
  { dim: "financial", q: "Você tem um DRE projetado para os próximos 12 meses?" },
  { dim: "financial", q: "Existem cenários (otimista/realista/pessimista)?" },
  { dim: "financial", q: "O funil comercial conecta leads → receita esperada?" },
];

const SCALE = [
  { v: 0, label: "Não" },
  { v: 33, label: "Início" },
  { v: 66, label: "Em prática" },
  { v: 100, label: "Maduro" },
];

export default function Onboarding() {
  const { user } = useAuth();
  const { data: m, isLoading } = useTenant();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [step, setStep] = useState(0);
  const [company, setCompany] = useState({ name: "", cnpj: "", sector: "", size_band: "", revenue_band: "" });
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [vision, setVision] = useState({ north_star: "", mission: "" });
  const [okr, setOkr] = useState({ title: "", kr: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (m?.tenants) {
      setCompany(c => ({ ...c, name: c.name || (m.tenants as any).name || "" }));
      if ((m.tenants as any).onboarding_completed) navigate("/dashboard");
    }
  }, [m, navigate]);

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const tenantId = m?.tenant_id;
  const totalSteps = 4;
  const progress = ((step + 1) / totalSteps) * 100;

  const finish = async () => {
    if (!tenantId) return;
    setSaving(true);
    try {
      // 1. update tenant
      await supabase.from("tenants").update({
        name: company.name, cnpj: company.cnpj || null,
        sector: company.sector, size_band: company.size_band, revenue_band: company.revenue_band,
        onboarding_completed: true,
      }).eq("id", tenantId);

      // 2. maturity
      const dims = ["vision", "okrs", "rituals", "team", "financial"] as const;
      for (const dim of dims) {
        const idx = QUESTIONS.map((q, i) => ({ q, i })).filter(x => x.q.dim === dim);
        const score = Math.round(idx.reduce((a, x) => a + (answers[x.i] ?? 0), 0) / idx.length);
        await supabase.from("maturity_assessments").insert({
          tenant_id: tenantId, dimension: dim, score, answers_json: idx.reduce((o, x) => ({ ...o, [x.i]: answers[x.i] ?? 0 }), {}),
        });
      }

      // 3. vision
      if (vision.north_star || vision.mission) {
        await supabase.from("vision_plans").insert({
          tenant_id: tenantId, year_horizon: 5,
          north_star: vision.north_star, mission: vision.mission, values_json: [],
        });
      }

      // 4. first OKR
      if (okr.title) {
        const { data: obj } = await supabase.from("okrs_objectives").insert({
          tenant_id: tenantId, level: "company", title: okr.title, owner_id: user!.id,
        }).select().single();
        if (obj && okr.kr) {
          await supabase.from("key_results").insert({
            tenant_id: tenantId, objective_id: obj.id, title: okr.kr, target: 100, current: 0, unit: "%",
          });
        }
      }

      qc.invalidateQueries();
      toast.success("Workspace pronto!");
      navigate("/dashboard");
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-2xl py-10">
        <div className="mb-8">
          <div className="font-serif text-lg font-bold text-primary">Strategic OS</div>
          <div className="text-xs text-muted-foreground">Configurar workspace · {step + 1} de {totalSteps}</div>
          <Progress value={progress} className="mt-3 h-1.5" />
        </div>

        <div className="bg-card border border-border rounded-xl p-6 md:p-8 shadow-soft">
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <h2 className="font-serif text-2xl font-bold text-primary">Sobre sua empresa</h2>
                <p className="text-sm text-muted-foreground mt-1">Esses dados aparecerão na capa do seu PDF.</p>
              </div>
              <div>
                <Label>Nome da empresa *</Label>
                <Input value={company.name} onChange={e => setCompany({ ...company, name: e.target.value })} placeholder="Ex.: Acme Indústria S.A." />
              </div>
              <div>
                <Label>CNPJ (opcional)</Label>
                <Input value={company.cnpj} onChange={e => setCompany({ ...company, cnpj: e.target.value })} placeholder="00.000.000/0000-00" />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label>Setor *</Label>
                  <Select value={company.sector} onValueChange={v => setCompany({ ...company, sector: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{SECTORS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tamanho do time *</Label>
                  <Select value={company.size_band} onValueChange={v => setCompany({ ...company, size_band: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{SIZE.map(s => <SelectItem key={s} value={s}>{s} pessoas</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Faturamento anual aproximado *</Label>
                <Select value={company.revenue_band} onValueChange={v => setCompany({ ...company, revenue_band: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{REVENUE.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="font-serif text-2xl font-bold text-primary">Diagnóstico de maturidade</h2>
                <p className="text-sm text-muted-foreground mt-1">15 perguntas em 5 dimensões. Seja honesto — vamos te dar recomendações personalizadas.</p>
              </div>
              <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
                {QUESTIONS.map((q, i) => (
                  <div key={i} className="border border-border rounded-lg p-4">
                    <div className="text-sm font-medium text-foreground mb-3">{i + 1}. {q.q}</div>
                    <RadioGroup value={String(answers[i] ?? "")} onValueChange={v => setAnswers({ ...answers, [i]: Number(v) })} className="grid grid-cols-4 gap-2">
                      {SCALE.map(s => (
                        <Label key={s.v} className={`flex flex-col items-center gap-1 border rounded-md p-2 cursor-pointer text-xs transition-smooth ${answers[i] === s.v ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                          <RadioGroupItem value={String(s.v)} className="sr-only" />
                          <span className="font-semibold">{s.v}</span>
                          <span className="text-muted-foreground">{s.label}</span>
                        </Label>
                      ))}
                    </RadioGroup>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="font-serif text-2xl font-bold text-primary">Sua visão de 5 anos</h2>
                <p className="text-sm text-muted-foreground mt-1">Pode ser rascunho — você refina depois.</p>
              </div>
              <div>
                <Label>North Star — onde a empresa estará em 5 anos?</Label>
                <Textarea rows={3} value={vision.north_star} onChange={e => setVision({ ...vision, north_star: e.target.value })}
                  placeholder="Ex.: Ser a referência em CFO-as-a-Service para PMEs no Brasil, com 1.000 clientes ativos." />
                <p className="text-xs text-muted-foreground mt-1">Por que importa: ancora todas as decisões dos próximos anos.</p>
              </div>
              <div>
                <Label>Missão</Label>
                <Textarea rows={2} value={vision.mission} onChange={e => setVision({ ...vision, mission: e.target.value })}
                  placeholder="Ex.: Levar gestão financeira de classe mundial para empresas brasileiras." />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="font-serif text-2xl font-bold text-primary">Seu primeiro OKR</h2>
                <p className="text-sm text-muted-foreground mt-1">Um objetivo company-level + um KR mensurável.</p>
              </div>
              <div>
                <Label>Objetivo</Label>
                <Input value={okr.title} onChange={e => setOkr({ ...okr, title: e.target.value })} placeholder="Ex.: Alcançar R$ 50M de ARR mantendo NPS &gt; 70" />
              </div>
              <div>
                <Label>Key Result principal</Label>
                <Input value={okr.kr} onChange={e => setOkr({ ...okr, kr: e.target.value })} placeholder="Ex.: Fechar 200 novos contratos com ticket médio R$ 250k" />
                <p className="text-xs text-muted-foreground mt-1">Mensurável, com prazo claro até o fim do ciclo.</p>
              </div>
            </div>
          )}

          <div className="mt-8 flex items-center justify-between">
            <Button variant="ghost" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
            {step < totalSteps - 1 ? (
              <Button onClick={() => setStep(s => s + 1)}
                disabled={
                  (step === 0 && (!company.name || !company.sector || !company.size_band || !company.revenue_band))
                }>
                Continuar <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={finish} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><CheckCircle2 className="h-4 w-4 mr-1" /> Concluir</>)}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
