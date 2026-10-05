import { useQuery } from "@tanstack/react-query";

import { backend } from "@/integrations/backend/client";
import { useRole } from "@/lib/role";

/**
 * Cursos que el usuario activo puede ver.
 * `null` significa "todos" (perfil Encargado / Administrador).
 */
export function useAllowedCourseIds(mode: "write" | "read" = "write") {
  const { role, user, loading } = useRole();

  const query = useQuery({
    queryKey: ["my-courses", user?.id],
    enabled: role === "educadora" && !!user?.id,
    queryFn: async () => {
      const { data, error } = await backend
        .from("courses")
        .select("id")
        .eq("teacher_profile_id", user!.id);
      if (error) throw error;
      return (data ?? []).map((c) => c.id);
    },
  });

  if (loading) return { ids: [] as string[], loading: true, restricted: true };
  if (role === "encargado") return { ids: null, loading: false, restricted: false };
  if (role === "educadora" && mode === "read") return { ids: null, loading: false, restricted: false };
  if (role === "educadora") {
    return { ids: query.data ?? [], loading: query.isLoading, restricted: true };
  }
  return { ids: [] as string[], loading: false, restricted: true };
}
