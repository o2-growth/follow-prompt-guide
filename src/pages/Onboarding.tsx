import { useEffect, useMemo, useState } from "react";
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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { captureError } from "@/lib/sentry";

const SECTORS = ["Serviços B2B", "Serviços B2C", "Indústria", "Varejo", "Tecnologia/SaaS", "Saúde", "Educação", "Construção", "Agro", "Outro"];
const SIZE = ["1–10", "11–50", "51–200", "201–500", "500+"];
const REVENUE = ["Até R$ 1M", "R$ 1M – 10M", "R$ 10M – 50M", "R$ 50M – 200M", "Acima de R$ 200M"];

const SCALE = [
  { v: 0, label: "Não" },
  { v: 33, label: "Início" },
  { v: 66, label: "Em prática" },
  { v: 100, label: "Maduro" },
];

type Question = { dimension: string; key: string; prompt: string };
type AssessmentPayload = { questions: Question[] };

export default function Onboarding() {
  const { user } = useAuth();
  const { data: m, isLoading } = useTenant();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [step, setStep] = useState(0);
  const [company, setCompany] = useState({ name: "", cnpj: "", sector: "", size_band: "", revenue_band: "" });
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [vision, setVision] = useState({ north_star: "", mission: "", values: "" });
  const [okr, setOkr] = useState({ title: "", kr: "" });
  const [saving, setSaving] = useState(false);

  const tenantId = m?.tenant_id;

  // Frente 3 / I3 / I5: questões via RPC `start_assessment`.
  const { data: assessment } = useQuery({
    queryKey: ["assessment-questions", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("start_assessment", { p_tenant_id: tenantId });
      if (error) throw error;
      return data as AssessmentPayload;
    },
  });

  const questions: Question[] = useMemo(() => {
    return Array.isArray(assessment?.questions) ? (assessment!.questions as Question[]) : [];
  }, [assessment]);

  useEffect(() => {
    if (m?.tenants) {
      const t = m.tenants as any;
      setCompany(c => ({ ...c, name: c.name || t.name || "" }));
      if (t.onboarding_completed) navigate("/dashboard");
    }
  }, [m, navigate]);

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const totalSteps = 4;
  const progress = ((step + 1) / totalSteps) * 100;
  const answered = questions.filter(q => answers[q.key] !== undefined).length;
  const allAnswered = questions.length > 0 && answered === questions.length;

  const finish = async () => {
    if (!tenantId || !user) return;
    setSaving(true);
    try {
      // 1. update tenant
      const { error: tenantErr } = await supabase.from("tenants").update({
        name: company.name,
        cnpj: company.cnpj || null,
        sector: company.sector,
        size_band: company.size_band,
        revenue_band: company.revenue_band,
        onboarding_completed: true,
      }).eq("id", tenantId);
      if (tenantErr) throw tenantErr;

      // 2. maturity via RPC compute_maturity_score (popula assessments + recommendations)
      const dims = ["vision", "okrs", "rituals", "team", "financial"] as const;
      const grouped: Record<string, number[]> = { vision: [], okrs: [], rituals: [], team: [], financial: [] };
      for (const q of questions) {
        const v = answers[q.key];
        if (typeof v === "number" && grouped[q.dimension]) grouped[q.dimension].push(v);
      }
      // Garante ordem e completa dimensões faltantes (não devem faltar com all-answered)
      const answersPayload: Record<string, number[]> = {};
      for (const d of dims) answersPayload[d] = grouped[d] ?? [];

      const { error: scoreErr } = await (supabase.rpc as any)("compute_maturity_score", {
        p_tenant_id: tenantId,
        p_answers: answersPayload,
      });
      if (scoreErr) throw scoreErr;

      // 3. vision
      if (vision.north_star || vision.mission) {
        const values_json = vision.values
          .split(",")
          .map(v => v.trim())
          .filter(Boolean);
        const { error: visionErr } = await supabase.from("vision_plans").insert({
          tenant_id: tenantId,
          year_horizon: 5,
          north_star: vision.north_star,
          mission: vision.mission,
          values_json,
        });
        if (visionErr) throw visionErr;
      }

      // 4. first OKR
      if (okr.title) {
        const { data: obj, error: objErr } = await supabase.from("okrs_objectives").insert({
          tenant_id: tenantId, level: "company", title: okr.title, owner_id: user.id,
        }).select().single();
        if (objErr) throw objErr;
        if (obj && okr.kr) {
          const { error: krErr } = await supabase.from("key_results").insert({
            tenant_id: tenantId, objective_id: obj.id, title: okr.kr, target: 100, current: 0, unit: "%",
          });
          if (krErr) throw krErr;
        }
      }

      // 5. audit log (não bloqueante)
      try {
        await (supabase.rpc as any)("log_event", {
          p_tenant_id: tenantId,
          p_action: "onboarding_completed",
          p_entity_type: "tenant",
          p_entity_id: tenantId,
          p_payload: { dims_count: questions.length },
        });
      } catch (logErr) {
        captureError(logErr, { step: "log_event onboarding_completed" });
      }

      qc.invalidateQueries();
      toast.success("Workspace pronto!");
      navigate("/dashboard");
    } catch (e: any) {
      captureError(e, { step: "onboarding.finish" });
      toast.error(e?.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  // Validações por step (BUG-002, BUG-003, BUG-004)
  const canAdvance = () => {
    if (step === 0) return !!company.name && !!company.sector && !!company.size_band && !!company.revenue_band;
    if (step === 1) return allAnswered;
    if (step === 2) return vision.north_star.trim().length >= 20;
    return true;
  };

  const finishDisabled = saving
    || okr.title.trim().length < 10
    || okr.kr.trim().length < 10;

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
                <p className="text-sm text-muted-foreground mt-1">
                  {questions.length} perguntas em 5 dimensões. Seja honesto — vamos te dar recomendações personalizadas.
                </p>
                <div className="text-xs font-medium text-accent mt-2">
                  {answered} de {questions.length} respondidas
                </div>
              </div>
              {!questions.length && (
                <div className="text-sm text-muted-foreground border border-dashed border-border rounded-lg p-4">
                  Carregando perguntas... Se demorar, recarregue a página.
                </div>
              )}
              <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
                {questions.map((q, i) => (
                  <div key={q.key} className="border border-border rounded-lg p-4">
                    <div className="text-sm font-medium text-foreground mb-3">{i + 1}. {q.prompt}</div>
                    <div role="radiogroup" className="grid grid-cols-4 gap-2">
                      {SCALE.map(s => {
                        const selected = answers[q.key] === s.v;
                        return (
                          <button
                            type="button"
                            key={s.v}
                            role="radio"
                            aria-checked={selected}
                            onClick={() => setAnswers({ ...answers, [q.key]: s.v })}
                            className={`flex flex-col items-center gap-1 border rounded-md p-2 text-xs transition-smooth focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                          >
                            <span className="font-semibold">{s.v}</span>
                            <span className="text-muted-foreground">{s.label}</span>
                          </button>
                        );
                      })}
                    </div>
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
                <Label>North Star — onde a empresa estará em 5 anos? *</Label>
                <Textarea rows={3} value={vision.north_star} onChange={e => setVision({ ...vision, north_star: e.target.value })}
                  placeholder="Ex.: Ser a referência em CFO-as-a-Service para PMEs no Brasil, com 1.000 clientes ativos." />
                <p className="text-xs text-muted-foreground mt-1">
                  Mínimo 20 caracteres. {vision.north_star.length}/20.
                </p>
              </div>
              <div>
                <Label>Missão</Label>
                <Textarea rows={2} value={vision.mission} onChange={e => setVision({ ...vision, mission: e.target.value })}
                  placeholder="Ex.: Levar gestão financeira de classe mundial para empresas brasileiras." />
              </div>
              <div>
                <Label>Valores (separe por vírgula)</Label>
                <Textarea rows={2} value={vision.values} onChange={e => setVision({ ...vision, values: e.target.value })}
                  placeholder="Excelência, transparência, foco no cliente" />
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
                <Label>Objetivo *</Label>
                <Input value={okr.title} onChange={e => setOkr({ ...okr, title: e.target.value })} placeholder="Ex.: Alcançar R$ 50M de ARR mantendo NPS > 70" />
                <p className="text-xs text-muted-foreground mt-1">
                  Mínimo 10 caracteres. {okr.title.length}/10.
                </p>
              </div>
              <div>
                <Label>Key Result principal *</Label>
                <Input value={okr.kr} onChange={e => setOkr({ ...okr, kr: e.target.value })} placeholder="Ex.: Fechar 200 novos contratos com ticket médio R$ 250k" />
                <p className="text-xs text-muted-foreground mt-1">
                  Mensurável, com prazo claro até o fim do ciclo. Mínimo 10 caracteres. {okr.kr.length}/10.
                </p>
              </div>
            </div>
          )}

          <div className="mt-8 flex items-center justify-between">
            <Button variant="ghost" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
            {step < totalSteps - 1 ? (
              <Button onClick={() => setStep(s => s + 1)} disabled={!canAdvance()}>
                Continuar <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={finish} disabled={finishDisabled}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><CheckCircle2 className="h-4 w-4 mr-1" /> Concluir</>)}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
