import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileCheck2, History, Lock, Search, ShieldCheck, UserRound } from "lucide-react";

import { backend } from "@/integrations/backend/client";
import { LEVELS, fullName } from "@/lib/school";
import { useAllowedCourseIds } from "@/lib/scope";
import { useRole } from "@/lib/role";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StudentForm } from "@/components/StudentForm";
import { InterviewSection, MovementsSection, SpeechTestSection } from "@/components/StudentSections";

type RegistryKind = "datos" | "matricula" | "movimientos";

const CONFIG = {
  datos: {
    title: "Ficha Estudiantil",
    description: "Información personal básica y datos del apoderado.",
    icon: UserRound,
  },
  matricula: {
    title: "Test Fonoaudiología y Entrevista Apoderado",
    description: "Test de fonoaudiología y entrevista a apoderados de cada estudiante.",
    icon: FileCheck2,
  },
  movimientos: {
    title: "Traslados",
    description: "Historial y registro de traslados, bajas o cambios del estudiante.",
    icon: History,
  },
} as const;

export function StudentRegistryView({ kind }: { kind: RegistryKind }) {
  const { ids: allowedCourseIds } = useAllowedCourseIds("read");
  const { canEditStudents } = useRole();
  const [q, setQ] = useState("");
  const [level, setLevel] = useState("todos");
  const [selected, setSelected] = useState<string | null>(null);
  const config = CONFIG[kind];
  const Icon = config.icon;

  const studentsQuery = useQuery({
    queryKey: ["student-registry"],
    queryFn: async () => {
      const { data, error } = await backend
        .from("students")
        .select("*, courses(name, level)")
        .order("apellido_paterno");
      if (error) throw error;
      return data ?? [];
    },
  });

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (studentsQuery.data ?? []).filter(
      (s) =>
        (allowedCourseIds === null || (s.course_id ? allowedCourseIds.includes(s.course_id) : false)) &&
        (level === "todos" || s.level === level) &&
        `${fullName(s)} ${s.run_ipe ?? ""}`.toLowerCase().includes(term),
    );
  }, [studentsQuery.data, allowedCourseIds, level, q]);

  const current = list.find((s) => s.id === selected) ?? list[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-heading flex items-center gap-3">
            <Icon className="size-7 text-primary" />
            {config.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{config.description}</p>
        </div>
        <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
          <ShieldCheck className="mr-1 size-3.5" />
          {canEditStudents ? "Lectura y escritura" : "Solo lectura"}
        </Badge>
      </div>

      <div className="rounded-xl border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
        <Lock className="mr-2 inline size-4 text-primary" />
        {canEditStudents
          ? "Acceso completo: puedes ver y modificar la información de este submódulo."
          : "Acceso de solo lectura a los estudiantes de tu curso."}
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="surface-panel space-y-3 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar estudiante" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los niveles</SelectItem>
              {LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <ul className="max-h-[520px] space-y-1 overflow-y-auto">
            {studentsQuery.isLoading && <li className="p-3 text-sm text-muted-foreground">Cargando…</li>}
            {list.map((s) => (
              <li key={s.id}>
                <Button
                  variant={current?.id === s.id ? "secondary" : "ghost"}
                  className="h-auto w-full justify-start py-2 text-left"
                  onClick={() => setSelected(s.id)}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{fullName(s)}</span>
                    <span className="block text-xs text-muted-foreground">{s.courses?.name ?? s.level}</span>
                  </span>
                </Button>
              </li>
            ))}
            {!studentsQuery.isLoading && list.length === 0 && (
              <li className="p-3 text-sm text-muted-foreground">Sin estudiantes.</li>
            )}
          </ul>
        </aside>

        <section className="space-y-6">
          {current ? (
            <>
              <div className="surface-panel p-6">
                <h2 className="font-display text-xl font-semibold">{fullName(current)}</h2>
                <p className="text-sm text-muted-foreground">
                  RUN {current.run_ipe ?? "—"} · {current.courses?.name ?? current.level}
                </p>
              </div>
              {kind === "datos" && (
                <div key={current.id} className="surface-panel p-6">
                  <StudentForm student={current} />
                </div>
              )}
              {kind === "matricula" && (
                <div key={current.id} className="space-y-6">
                  <SpeechTestSection student={current} canEdit={canEditStudents} />
                  <InterviewSection student={current} canEdit={canEditStudents} />
                </div>
              )}
              {kind === "movimientos" && (
                <MovementsSection key={current.id} studentId={current.id} canEdit={canEditStudents} />
              )}
            </>
          ) : (
            <p className="surface-panel p-6 text-sm text-muted-foreground">Selecciona un estudiante.</p>
          )}
        </section>
      </div>
    </div>
  );
}
