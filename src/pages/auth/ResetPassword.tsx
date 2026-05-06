import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { AuthLayout } from "./Login";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Listener dispara PASSWORD_RECOVERY quando o usuário chega via link de e-mail.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
        setChecking(false);
      }
    });

    // Fallback: se já existe sessão (token processado), libera o form.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setReady(true);
      }
      setChecking(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return toast.error("A senha precisa ter ao menos 8 caracteres");
    if (password !== confirm) return toast.error("As senhas não coincidem");

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Senha redefinida com sucesso");
    navigate("/auth/callback");
  };

  return (
    <AuthLayout
      title="Nova senha"
      subtitle="Defina uma nova senha para sua conta"
      footer={<><Link to="/auth/login" className="text-primary font-medium underline-offset-4 hover:underline">Voltar para entrar</Link></>}
    >
      {checking ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : !ready ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Link inválido ou expirado. Solicite um novo link de recuperação.
          </p>
          <Button asChild className="w-full"><Link to="/auth/forgot-password">Pedir novo link</Link></Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="password">Nova senha</Label>
            <Input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="confirm">Confirmar senha</Label>
            <Input id="confirm" type="password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Redefinir senha"}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
