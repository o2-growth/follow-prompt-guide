import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useEnsureTenant } from "@/hooks/useEnsureTenant";
import { Loader2 } from "lucide-react";

/**
 * ProtectedRoute — exige user autenticado.
 * Adicionalmente, se a rota NÃO é /onboarding e o tenant.onboarding_completed
 * é false, força ida pra /onboarding (gate C4).
 *
 * useEnsureTenant() roda uma vez por user pra garantir membership existe
 * (fallback BUG-001 caso o trigger handle_new_user tenha falhado).
 */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  // Idempotente: cria tenant+membership se faltar.
  useEnsureTenant();
  const { data: tenant, isLoading: tenantLoading } = useTenant();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth/login" state={{ from: location }} replace />;

  // Espera o useTenant resolver pra evitar redirect prematuro pra /onboarding
  // quando o usuário acabou de logar.
  if (tenantLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const onboardingDone =
    ((tenant as any)?.tenants as any)?.onboarding_completed === true;
  const isOnboardingRoute = location.pathname.startsWith("/onboarding");

  if (!onboardingDone && !isOnboardingRoute) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
