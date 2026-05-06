import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Settings as SettingsIcon } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export default function Settings() {
  const { user } = useAuth();
  const { data: m } = useTenant();
  const qc = useQueryClient();
  const [tenant, setTenant] = useState({ name: "", cnpj: "", sector: "" });
  const [profile, setProfile] = useState({ full_name: "", role_title: "" });

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
    </div>
  );
}
