import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { ReactNode } from "react";

export type AISurface = "okrs" | "team" | "financial" | "rituals" | "vision";

interface Props {
  surface: AISurface;
  title: string;
  /** Render do conteúdo quando `content_json` está pronto. */
  renderContent: (content: any) => ReactNode;
  /** Texto curto que descreve o que a IA vai analisar nesta página. */
  description: string;
  /** Ação opcional de aplicar — botão extra ao lado de Regerar. */
  applyAction?: { label: string; onApply: (content: any) => Promise<void> | void };
}

export function AIInsightPanel({ surface, title, description, renderContent, applyAction }: Props) {
  const { data: m } = useTenant();
  const tenantId = m?.tenant_id;
  const qc = useQueryClient();

  const { data: row, isLoading } = useQuery({
    queryKey: ["ai_suggestions", tenantId, surface],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await (supabase.from as any)("ai_suggestions")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("surface", surface)
        .maybeSingle();
      return data ?? null;
    },
  });

  const generate = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("ai-suggest", {
        body: { tenant_id: tenantId, surface },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai_suggestions", tenantId, surface] });
      toast.success("Análise gerada");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao gerar análise"),
  });

  const apply = useMutation({
    mutationFn: async () => {
      if (!applyAction || !row?.content_json) return;
      await applyAction.onApply(row.content_json);
    },
    onSuccess: () => toast.success("Sugestão aplicada"),
    onError: (e: any) => toast.error(e?.message ?? "Falha ao aplicar"),
  });

  const ready = row?.status === "ready" && row?.content_json;
  const generating = generate.isPending || row?.status === "generating";

  return (
    <Card className="shadow-soft border-accent/30 bg-gradient-to-br from-accent/5 to-transparent">
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-accent/15 flex items-center justify-center shrink-0">
              <Sparkles className="h-5 w-5 text-accent" />
            </div>
            <div>
              <CardTitle className="font-serif text-lg">{title}</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-xl">{description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {ready && applyAction && (
              <Button size="sm" variant="default" disabled={apply.isPending} onClick={() => apply.mutate()}>
                {apply.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                {applyAction.label}
              </Button>
            )}
            <Button size="sm" variant="outline" disabled={generating} onClick={() => generate.mutate()}>
              {generating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
              {ready ? "Regerar" : "Gerar análise"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : generating ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Analisando seus dados…
          </div>
        ) : ready ? (
          <div className="text-sm">{renderContent(row.content_json)}</div>
        ) : row?.status === "failed" ? (
          <div className="text-sm text-destructive">{row.error_message ?? "Falha na geração."}</div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Clique em <span className="font-medium text-foreground">Gerar análise</span> para obter recomendações personalizadas com base no seu diagnóstico.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default AIInsightPanel;
