import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CircleSlash, FileCheck2 } from "lucide-react";
import { toast } from "sonner";
import { backend } from "@/integrations/backend/client";
import {
  ATTENDANCE_STATUS,
  STATUS_LABEL,
  formatDateLong,
  fullName,
  toIsoDate,
  type AttendanceStatus,
} from "@/lib/school";
import { useAllowedCourseIds } from "@/lib/scope";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/asistencia")({
  head: () => ({
    meta: [
      { title: "Asistencia diaria por curso — Escuela Paihuen" },
      {
        name: "description",
        content:
          "Registro digital de asistencia por curso con presente, ausente o justificado y conteo automático de asistencia mensual.",
      },
      { property: "og:title", content: "Asistencia diaria por curso" },
      {
        property: "og:description",
        content:
          "Reemplaza el libro de asistencia en papel con registro digital y conteo automático.",
      },
    ],
  }),
  component: AttendancePage,
});

function AttendancePage() {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(() => toIsoDate(new Date()));
  const [courseId, setCourseId] = useState<string>("");

  const monthStart = date.slice(0, 7) + "-01";
  const monthEnd = (() => {
    const [y, m] = date.split("-").map(Number);
    return toIsoDate(new Date(y ?? 2026, m ?? 1, 0));
  })();

  const { ids: allowedCourseIds, restricted } = useAllowedCourseIds();

  const courses = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const { data, error } = await backend.from("courses").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const visibleCourses = (courses.data ?? []).filter(
    (c) => allowedCourseIds === null || allowedCourseIds.includes(c.id),
  );

  const activeCourse =
    (courseId && visibleCourses.some((c) => c.id === courseId) ? courseId : "") ||
    visibleCourses[0]?.id ||
    "";

  const students = useQuery({
    queryKey: ["course-students", activeCourse],
    enabled: !!activeCourse,
    queryFn: async () => {
      const { data, error } = await backend
        .from("students")
        .select("id, list_number, apellido_paterno, apellido_materno, nombres, run_ipe")
        .eq("course_id", activeCourse)
        .eq("active", true)
        .order("list_number");
      if (error) throw error;
      return data ?? [];
    },
  });

  const dayRecords = useQuery({
    queryKey: ["attendance-day", activeCourse, date],
    enabled: !!activeCourse,
    queryFn: async () => {
      const { data, error } = await backend
        .from("attendance")
        .select("id, student_id, status")
        .eq("course_id", activeCourse)
        .eq("attendance_date", date);
      if (error) throw error;
      return data ?? [];
    },
  });

  const monthRecords = useQuery({
    queryKey: ["attendance-month", activeCourse, monthStart],
    enabled: !!activeCourse,
    queryFn: async () => {
      const { data, error } = await backend
        .from("attendance")
        .select("status, attendance_date")
        .eq("course_id", activeCourse)
        .gte("attendance_date", monthStart)
        .lte("attendance_date", monthEnd);
      if (error) throw error;
      return data ?? [];
    },
  });

  const statusByStudent = useMemo(() => {
    const map = new Map<string, AttendanceStatus>();
    for (const r of dayRecords.data ?? []) map.set(r.student_id, r.status as AttendanceStatus);
    return map;
  }, [dayRecords.data]);

  const mark = useMutation({
    mutationFn: async ({ studentId, status }: { studentId: string; status: AttendanceStatus }) => {
      const { error } = await backend.from("attendance").upsert(
        {
          student_id: studentId,
          course_id: activeCourse,
          attendance_date: date,
          status,
        },
        { onConflict: "student_id,attendance_date" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance-day"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-month"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error("No se pudo guardar la asistencia", { description: e.message }),
  });

  const markAll = useMutation({
    mutationFn: async (status: AttendanceStatus) => {
      const rows = (students.data ?? []).map((s) => ({
        student_id: s.id,
        course_id: activeCourse,
        attendance_date: date,
        status,
      }));
      if (rows.length === 0) return;
      const { error } = await backend
        .from("attendance")
        .upsert(rows, { onConflict: "student_id,attendance_date" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Asistencia del día actualizada");
      queryClient.invalidateQueries({ queryKey: ["attendance-day"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-month"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error("No se pudo guardar", { description: e.message }),
  });

  const total = students.data?.length ?? 0;
  const dayPresent = (dayRecords.data ?? []).filter((r) => r.status !== "ausente").length;
  const dayAbsent = (dayRecords.data ?? []).filter((r) => r.status === "ausente").length;
  const pending = total - (dayRecords.data?.length ?? 0);

  const monthRows = monthRecords.data ?? [];
  const monthPresent = monthRows.filter((r) => r.status !== "ausente").length;
  const monthPct = monthRows.length
    ? Math.round((monthPresent / monthRows.length) * 1000) / 10
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-heading">Asistencia diaria por curso</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Registro digital que reemplaza la hoja física del libro de clases, con conteo automático.
        </p>
      </div>

      {restricted && (
        <div className="rounded-xl border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
          {visibleCourses.length === 0
            ? "Aún no tienes cursos asignados. Pide al Encargado que te asigne uno."
            : "Ves únicamente los cursos que tienes asignados."}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Curso
          </label>
          <Select value={activeCourse} onValueChange={setCourseId}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Selecciona un curso" />
            </SelectTrigger>
            <SelectContent>
              {visibleCourses.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} · {c.level}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Fecha
          </label>
          <Input
            type="date"
            className="w-48"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => markAll.mutate("presente")}>
            <CheckCircle2 className="mr-1 size-4" /> Todos presentes
          </Button>
          <Button variant="outline" onClick={() => markAll.mutate("ausente")}>
            <CircleSlash className="mr-1 size-4" /> Todos ausentes
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={`Presentes ${formatDateLong(date)}`} value={dayPresent} />
        <Stat label="Ausentes del día" value={dayAbsent} />
        <Stat label="Sin registrar" value={pending < 0 ? 0 : pending} />
        <Stat label="Asistencia del mes" value={`${monthPct}%`} />
      </div>

      <div className="surface-panel overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">N° lista</TableHead>
              <TableHead>Estudiante</TableHead>
              <TableHead>RUN / IPE</TableHead>
              <TableHead className="text-right">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.isLoading && (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  Cargando lista del curso…
                </TableCell>
              </TableRow>
            )}
            {!students.isLoading && total === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  Este curso no tiene estudiantes activos.
                </TableCell>
              </TableRow>
            )}
            {(students.data ?? []).map((s) => {
              const current = statusByStudent.get(s.id);
              return (
                <TableRow key={s.id}>
                  <TableCell>{s.list_number ?? "—"}</TableCell>
                  <TableCell className="font-medium">{fullName(s)}</TableCell>
                  <TableCell>{s.run_ipe ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap justify-end gap-1">
                      {ATTENDANCE_STATUS.map((st) => (
                        <Button
                          key={st}
                          size="sm"
                          variant={current === st ? "default" : "outline"}
                          onClick={() => mark.mutate({ studentId: s.id, status: st })}
                        >
                          {STATUS_LABEL[st]}
                        </Button>
                      ))}
                      {!current && (
                        <Badge variant="outline" className="ml-1 self-center">
                          Sin registro
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <FileCheck2 className="size-4 text-primary" />
        Los registros quedan disponibles en Revisión SIGE para el cierre mensual.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="mt-2 font-display text-3xl font-semibold text-primary-deep">{value}</p>
      </CardContent>
    </Card>
  );
}
