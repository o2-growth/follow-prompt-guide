import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { AuthLayout } from "./Login";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/auth/reset-password",
    });
    setLoading(false);
    if (error) {
      toast.error("Não foi possível enviar agora. Tente novamente.");
      return;
    }
    setSent(true);
  };

  return (
    <AuthLayout
      title="Recuperar senha"
      subtitle="Enviaremos um link para redefinir sua senha"
      footer={<>Lembrou? <Link to="/auth/login" className="text-primary font-medium underline-offset-4 hover:underline">Voltar para entrar</Link></>}
    >
      {sent ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Se existir uma conta com esse e-mail, enviamos um link para redefinir a senha. Verifique sua caixa de entrada e o spam.
          </p>
          <Button asChild className="w-full"><Link to="/auth/login">Voltar para entrar</Link></Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com.br" />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar link de recuperação"}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
