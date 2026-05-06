import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./useAuth";

export function useTenant() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["current-tenant", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: m, error } = await supabase
        .from("memberships")
        .select("tenant_id, role, tenants(*)")
        .eq("user_id", user!.id)
        .order("joined_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return m;
    },
  });
}
