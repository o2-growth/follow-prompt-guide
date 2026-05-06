import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { captureError } from "@/lib/sentry";

/**
 * Garante que o user logado tem um tenant + membership owner.
 * Idempotente: chama a RPC `ensure_tenant_for_user` (criada em
 * 20260506_dara_critical_fixes.sql), que retorna o tenant_id.
 *
 * Útil como fallback caso o trigger handle_new_user tenha falhado
 * em algum signup antigo (antes do fix do BUG-001).
 */
export function useEnsureTenant() {
  const { user } = useAuth();
  const qc = useQueryClient();
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        // RPC novo: types.ts ainda não foi regenerado, por isso o cast.
        const { error } = await (supabase.rpc as any)("ensure_tenant_for_user");
        if (!error) {
          qc.invalidateQueries({ queryKey: ["current-tenant"] });
        }
      } catch (e) {
        captureError(e, { hook: "useEnsureTenant" });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
}
