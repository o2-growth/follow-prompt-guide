import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { AuthLayout } from "./Login";
import { useAuth } from "@/hooks/useAuth";
import { captureError } from "@/lib/sentry";

// Máscara BR: (11) 99999-9999
function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10)
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export default function Signup() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  if (!authLoading && user) {
    return <Navigate to="/auth/callback" replace />;
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length < 10)
      return toast.error("Informe um telefone válido com DDD");
    if (password.length < 8)
      return toast.error("A senha precisa ter ao menos 8 caracteres");

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin + "/auth/callback",
        data: { full_name: name, phone: phoneDigits },
      },
    });

    if (error) {
      setLoading(false);
      return toast.error(error.message);
    }

    // Dispara card no Pipefy (não bloqueante)
    supabase.functions
      .invoke("pipefy-create-lead", { body: {} })
      .catch((err) => captureError(err, { step: "pipefy-create-lead invoke" }));

    setLoading(false);
    toast.success("Conta criada! Bem-vindo(a).");
    navigate("/auth/callback");
  };

  const onGoogle = async () => {
    setLoading(true);
    try {
      const r = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + "/auth/callback",
      });
      if (r.error) {
        toast.error("Erro ao entrar com Google");
        setLoading(false);
        return;
      }
      if (r.redirected) return;
      window.location.href = "/auth/callback";
    } catch {
      toast.error("Erro ao entrar com Google");
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Criar conta"
      subtitle="Comece seu plano estratégico em minutos"
      footer={<>Já tem conta? <Link to="/auth/login" className="text-primary font-medium underline-offset-4 hover:underline">Entrar</Link></>}
    >
      <Button onClick={onGoogle} variant="outline" className="w-full" disabled={loading}>
        <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.99 10.99 0 0 0 12 23z"/><path fill="#FBBC04" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18A10.99 10.99 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.83z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>
        Continuar com Google
      </Button>
      <div className="relative my-2">
        <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
        <div className="relative flex justify-center text-xs"><span className="bg-background px-2 text-muted-foreground">ou com e-mail</span></div>
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <Label htmlFor="name">Nome completo</Label>
          <Input id="name" required value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="email">E-mail corporativo</Label>
          <Input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="phone">Telefone (WhatsApp)</Label>
          <Input
            id="phone"
            type="tel"
            inputMode="tel"
            required
            placeholder="(11) 99999-9999"
            value={phone}
            onChange={e => setPhone(maskPhone(e.target.value))}
          />
          <p className="text-xs text-muted-foreground mt-1">DDD + número.</p>
        </div>
        <div>
          <Label htmlFor="password">Senha</Label>
          <Input id="password" type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} />
          <p className="text-xs text-muted-foreground mt-1">Mínimo 8 caracteres.</p>
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar conta"}
        </Button>
      </form>
    </AuthLayout>
  );
}
