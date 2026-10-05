import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Lock, Search } from "lucide-react";
import { backend } from "@/integrations/backend/client";
import { ROLE_LABEL, fullName } from "@/lib/school";
import { useRole } from "@/lib/role";
import { useAllowedCourseIds } from "@/lib/scope";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HealthPanel, ProtectedDataBadge } from "@/components/HealthPanel";

export const Route = createFileRoute("/estudiantes/salud")({
  head: () => ({
    meta: [
      { title: "Salud escolar y Ley 21.719 — Escuela Paihuen" },
      {
        name: "description",
        content:
          "Ficha digital de salud escolar con alergias, condiciones preexistentes, tipo de sangre y contactos de emergencia, con acceso por perfil.",
      },
      { property: "og:title", content: "Salud escolar — Ley N.º 21.719" },
      {
        property: "og:description",
        content: "Ficha de salud vinculada a la ficha del estudiante, con control de acceso.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HealthPage,
});

export function HealthPage() {
  const { role, session } = useRole();
  const { ids: allowedCourseIds } = useAllowedCourseIds("read");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const students = useQuery({
    queryKey: ["students-health"],
    queryFn: async () => {
      const [studentRes, allergyRes] = await Promise.all([
        backend
          .from("students")
          .select(
            "id, course_id, apellido_paterno, apellido_materno, nombres, run_ipe, level, courses(name)",
          )
          .order("apellido_paterno"),
        backend.from("health_allergies").select("student_id"),
      ]);
      if (studentRes.error) throw studentRes.error;
      const counts = new Map<string, number>();
      for (const a of allergyRes.data ?? []) {
        counts.set(a.student_id, (counts.get(a.student_id) ?? 0) + 1);
      }
      return (studentRes.data ?? []).map((s) => ({ ...s, allergies: counts.get(s.id) ?? 0 }));
    },
  });

  const inScope = (students.data ?? []).filter(
    (s) =>
      role === "apoderado" ||
      allowedCourseIds === null ||
      (s.course_id ? allowedCourseIds.includes(s.course_id) : false),
  );
  const visible = inScope.filter((s) => fullName(s).toLowerCase().includes(q.toLowerCase()));
  const list = role === "apoderado" ? visible.slice(0, 1) : visible;
  const current = list.find((s) => s.id === selected) ?? list[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-heading">Salud escolar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ficha vinculada al estudiante, sin duplicar RUN ni nombres.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <ProtectedDataBadge />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Perfil activo:</span>
            <span className="rounded-md bg-muted px-2 py-1 font-medium text-foreground">
              {session ? ROLE_LABEL[role] : "Visitante sin ingresar"}
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
        <Lock className="mr-2 inline size-4 text-primary" />
        {role === "encargado" &&
          "Acceso completo: puedes ver, crear, editar y eliminar información de salud."}
        {role === "educadora" &&
          "Acceso de lectura completa a los estudiantes de tu curso; no puedes editar ni eliminar."}
        {role === "apoderado" &&
          "Acceso de lectura exclusivo a la ficha de tu hijo o hija; no puedes editar ni eliminar."}
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="surface-panel p-4">
          {role !== "apoderado" && (
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar estudiante"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          )}
          <ul className="max-h-[520px] space-y-1 overflow-y-auto">
            {list.map((s) => (
              <li key={s.id}>
                <Button
                  variant={current?.id === s.id ? "secondary" : "ghost"}
                  className="h-auto w-full justify-start py-2 text-left"
                  onClick={() => setSelected(s.id)}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{fullName(s)}</span>
                    <span className="block text-xs text-muted-foreground">
                      {s.courses?.name ?? s.level}
                      {s.allergies > 0 ? ` · ${s.allergies} alergia(s)` : ""}
                    </span>
                  </span>
                </Button>
              </li>
            ))}
            {list.length === 0 && (
              <li className="p-3 text-sm text-muted-foreground">Sin estudiantes.</li>
            )}
          </ul>
        </aside>

        <section className="surface-panel p-6">
          {current ? (
            <>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-semibold">{fullName(current)}</h2>
                  <p className="text-sm text-muted-foreground">
                    RUN {current.run_ipe ?? "—"} · {current.courses?.name ?? current.level}
                  </p>
                </div>
                <Badge variant="outline">{ROLE_LABEL[role]}</Badge>
              </div>
              <HealthPanel studentId={current.id} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Selecciona un estudiante.</p>
          )}
        </section>
      </div>
    </div>
  );
}
