import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Settings as SettingsIcon, Shield, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { captureError } from "@/lib/sentry";

export default function Settings() {
  const { user } = useAuth();
  const { data: m } = useTenant();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState({ name: "", cnpj: "", sector: "" });
  const [profile, setProfile] = useState({ full_name: "", role_title: "" });
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    if (m?.tenants) {
      const t = m.tenants as any;
      setTenant({ name: t.name ?? "", cnpj: t.cnpj ?? "", sector: t.sector ?? "" });
    }
    if (user) {
      supabase.from("user_profiles").select("*").eq("id", user.id).maybeSingle().then(({ data }) => {
        if (data) setProfile({ full_name: data.full_name ?? "", role_title: data.role_title ?? "" });
      });
    }
  }, [m, user]);

  const saveTenant = async () => {
    if (!m?.tenant_id) return;
    await supabase.from("tenants").update(tenant).eq("id", m.tenant_id);
    qc.invalidateQueries({ queryKey: ["current-tenant"] });
    toast.success("Workspace atualizado");
  };
  const saveProfile = async () => {
    if (!user) return;
    await supabase.from("user_profiles").upsert({ id: user.id, ...profile });
    toast.success("Perfil atualizado");
  };

  const exportMyData = async () => {
    // TODO Fase 2: RPC `export_tenant_data` retornando jsonb completo.
    // Por agora gera JSON local com o que já temos via cliente (RLS protege).
    if (!m?.tenant_id) return;
    try {
      const tenantId = m.tenant_id;
      const [tenantRow, vision, objectives, krs, maturity, rituals, projections, dre] = await Promise.all([
        supabase.from("tenants").select("*").eq("id", tenantId).maybeSingle(),
        supabase.from("vision_plans").select("*").eq("tenant_id", tenantId),
        supabase.from("okrs_objectives").select("*").eq("tenant_id", tenantId),
        supabase.from("key_results").select("*").eq("tenant_id", tenantId),
        supabase.from("maturity_assessments").select("*").eq("tenant_id", tenantId),
        supabase.from("rituals").select("*").eq("tenant_id", tenantId),
        supabase.from("financial_projections").select("*").eq("tenant_id", tenantId),
        supabase.from("dre_line_items").select("*").eq("tenant_id", tenantId),
      ]);
      const payload = {
        exported_at: new Date().toISOString(),
        tenant: tenantRow.data,
        vision_plans: vision.data,
        okrs_objectives: objectives.data,
        key_results: krs.data,
        maturity_assessments: maturity.data,
        rituals: rituals.data,
        financial_projections: projections.data,
        dre_line_items: dre.data,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `strategic-os-export-${tenantId}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Exportação concluída");
    } catch (e) {
      captureError(e, { step: "export_my_data" });
      toast.error("Erro ao exportar dados");
    }
  };

  const deleteWorkspace = async () => {
    if (!m?.tenant_id) return;
    try {
      // Soft delete
      const { error } = await supabase
        .from("tenants")
        .update({ deleted_at: new Date().toISOString() } as any)
        .eq("id", m.tenant_id);
      if (error) {
        // Caso a coluna deleted_at ainda não exista (tipos não regenerados),
        // grava só audit log e mostra aviso.
        captureError(error, { step: "deleteWorkspace soft" });
        toast.error("Falha ao excluir — contate suporte (DPO).");
        return;
      }
      try {
        await (supabase.rpc as any)("log_event", {
          p_tenant_id: m.tenant_id,
          p_action: "workspace_deleted",
          p_entity_type: "tenant",
          p_entity_id: m.tenant_id,
          p_payload: {},
        });
      } catch {}
      toast.success("Workspace excluído");
      await supabase.auth.signOut();
      navigate("/");
    } catch (e) {
      captureError(e, { step: "deleteWorkspace" });
      toast.error("Erro ao excluir workspace");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <SettingsIcon className="h-7 w-7 text-accent" />
        <div>
          <h1 className="font-serif text-3xl font-bold text-primary">Configurações</h1>
          <p className="text-muted-foreground">Workspace e perfil.</p>
        </div>
      </div>
      <Card className="shadow-soft">
        <CardHeader><CardTitle className="font-serif">Workspace</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div><Label>Nome da empresa</Label><Input value={tenant.name} onChange={e => setTenant({ ...tenant, name: e.target.value })} /></div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div><Label>CNPJ</Label><Input value={tenant.cnpj ?? ""} onChange={e => setTenant({ ...tenant, cnpj: e.target.value })} /></div>
            <div><Label>Setor</Label><Input value={tenant.sector ?? ""} onChange={e => setTenant({ ...tenant, sector: e.target.value })} /></div>
          </div>
          <Button onClick={saveTenant}>Salvar workspace</Button>
        </CardContent>
      </Card>
      <Card className="shadow-soft">
        <CardHeader><CardTitle className="font-serif">Meu perfil</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div><Label>Nome</Label><Input value={profile.full_name} onChange={e => setProfile({ ...profile, full_name: e.target.value })} /></div>
          <div><Label>Cargo</Label><Input value={profile.role_title} onChange={e => setProfile({ ...profile, role_title: e.target.value })} placeholder="Ex.: CEO" /></div>
          <Button onClick={saveProfile}>Salvar perfil</Button>
        </CardContent>
      </Card>

      <Card className="shadow-soft border-destructive/30">
        <CardHeader>
          <CardTitle className="font-serif flex items-center gap-2">
            <Shield className="h-5 w-5 text-accent" /> Privacidade & dados (LGPD)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            Você pode exportar todos os dados do seu workspace ou solicitar a exclusão total.
            Em conformidade com a LGPD (art. 18). Dúvidas: <a href="mailto:dpo@o2inc.com.br" className="underline">dpo@o2inc.com.br</a>.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={exportMyData}>
              <Download className="h-4 w-4 mr-1" /> Exportar meus dados
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="h-4 w-4 mr-1" /> Excluir workspace
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir workspace</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação é irreversível. Para confirmar, digite o nome do workspace
                    (<strong>{tenant.name}</strong>) abaixo. Soft-delete: dados ficam retidos por 30 dias
                    para recuperação via DPO.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <Input
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                  placeholder={tenant.name}
                />
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setConfirmText("")}>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={confirmText.trim() !== tenant.name.trim() || !tenant.name}
                    onClick={deleteWorkspace}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Excluir definitivamente
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
