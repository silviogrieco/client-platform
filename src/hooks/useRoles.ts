import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useRoles() {
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (mounted) {
          setRoles([]);
          setLoading(false);
        }
        return;
      }
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      if (mounted) {
        if (!error) setRoles((data || []).map((r: any) => r.role));
        setLoading(false);
      }
    };
    load();
    return () => { mounted = false };
  }, []);

  const isAdmin = roles.includes("admin");

  return { roles, isAdmin, loading };
}
