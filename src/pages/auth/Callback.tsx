import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { captureError } from "@/lib/sentry";

/**
 * AuthCallback — pós-OAuth.
 * 1. Espera a sessão estar persistida.
 * 2. Garante tenant via RPC `ensure_tenant_for_user` (idempotente).
 * 3. Lê tenant.onboarding_completed e roteia:
 *    - false (ou sem tenant) → /onboarding
 *    - true                  → /dashboard
 * 4. Se algo travar > 3s, fallback duro pra /dashboard.
 */
export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    const fallback = setTimeout(() => {
      if (!cancelled) navigate("/dashboard", { replace: true });
    }, 3000);

    (async () => {
      try {
        // 1. Espera a sessão de fato estar disponível.
        const { data: sess } = await supabase.auth.getSession();
        if (!sess.session) {
          if (!cancelled) navigate("/auth/login", { replace: true });
          return;
        }

        // 2. Garante tenant + membership.
        try {
          await (supabase.rpc as any)("ensure_tenant_for_user");
        } catch (e) {
          captureError(e, { step: "ensure_tenant_for_user" });
        }

        // 3. Busca tenant atual + onboarding_completed.
        const userId = sess.session.user.id;
        const { data: m, error } = await supabase
          .from("memberships")
          .select("tenant_id, tenants(onboarding_completed)")
          .eq("user_id", userId)
          .order("joined_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (cancelled) return;

        if (error || !m) {
          // Mesmo sem tenant, manda pra onboarding (vai recriar via useEnsureTenant).
          navigate("/onboarding", { replace: true });
          return;
        }

        const onboardingDone =
          // tenants pode vir como objeto ou array dependendo de como Supabase resolve a join
          (Array.isArray((m as any).tenants)
            ? (m as any).tenants[0]?.onboarding_completed
            : (m as any).tenants?.onboarding_completed) === true;

        navigate(onboardingDone ? "/dashboard" : "/onboarding", { replace: true });
      } catch (e) {
        captureError(e, { component: "AuthCallback" });
        if (!cancelled) navigate("/dashboard", { replace: true });
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(fallback);
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
