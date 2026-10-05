import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { backend } from "@/integrations/backend/client";
import { MONTHS, fullName, schoolDays } from "@/lib/school";
import { useAllowedCourseIds } from "@/lib/scope";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

export const Route = createFileRoute("/sige")({
  head: () => ({
    meta: [
      { title: "Revisión Pre-SIGE y exportación Excel — Escuela Paihuen" },
      {
        name: "description",
        content:
          "Revisión mensual de asistencia por curso con alertas de omisiones y descarga de la planilla Excel para la carga en SIGE.",
      },
      { property: "og:title", content: "Revisión Pre-SIGE y exportación a Excel" },
      {
        property: "og:description",
        content:
          "Detecta omisiones antes del envío oficial y genera la planilla mensual de asistencia.",
      },
    ],
  }),
  component: SigePage,
});

const CODE: Record<string, string> = { presente: "1", justificado: "1", ausente: "0" };

function SigePage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [courseId, setCourseId] = useState("");

  const days = useMemo(() => schoolDays(year, month), [year, month]);
  const monthStart = days[0] ?? `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEnd = days[days.length - 1] ?? monthStart;

  const { ids: allowedCourseIds } = useAllowedCourseIds();

  const coursesQuery = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const { data, error } = await backend.from("courses").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const visibleCourses = (coursesQuery.data ?? []).filter(
    (c) => allowedCourseIds === null || allowedCourseIds.includes(c.id),
  );
  const courses = { ...coursesQuery, data: visibleCourses };

  const activeCourse =
    (courseId && visibleCourses.some((c) => c.id === courseId) ? courseId : "") ||
    visibleCourses[0]?.id ||
    "";
  const course = visibleCourses.find((c) => c.id === activeCourse);

  const data = useQuery({
    queryKey: ["sige", activeCourse, year, month],
    enabled: !!activeCourse,
    queryFn: async () => {
      const [studentRes, attRes] = await Promise.all([
        backend
          .from("students")
          .select("id, list_number, apellido_paterno, apellido_materno, nombres, run_ipe, level")
          .eq("course_id", activeCourse)
          .eq("active", true)
          .order("list_number"),
        backend
          .from("attendance")
          .select("student_id, attendance_date, status")
          .eq("course_id", activeCourse)
          .gte("attendance_date", monthStart)
          .lte("attendance_date", monthEnd),
      ]);
      if (studentRes.error) throw studentRes.error;
      if (attRes.error) throw attRes.error;
      return { students: studentRes.data ?? [], records: attRes.data ?? [] };
    },
  });

  const students = data.data?.students ?? [];
  const records = data.data?.records ?? [];

  const byStudentDay = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of records) map.set(`${r.student_id}|${r.attendance_date}`, r.status);
    return map;
  }, [records]);

  const incompleteDays = days.filter((d) => {
    const count = records.filter((r) => r.attendance_date === d).length;
    return students.length > 0 && count > 0 && count < students.length;
  });
  const missingDays = days.filter((d) => !records.some((r) => r.attendance_date === d));

  const summary = students.map((s) => {
    const present = days.filter((d) => {
      const st = byStudentDay.get(`${s.id}|${d}`);
      return st === "presente" || st === "justificado";
    }).length;
    const absent = days.filter((d) => byStudentDay.get(`${s.id}|${d}`) === "ausente").length;
    const recorded = present + absent;
    return {
      ...s,
      present,
      absent,
      recorded,
      missing: days.length - recorded,
      pct: recorded ? Math.round((present / recorded) * 1000) / 10 : 0,
    };
  });

  const totalPresent = summary.reduce((a, s) => a + s.present, 0);
  const totalRecorded = summary.reduce((a, s) => a + s.recorded, 0);
  const coursePct = totalRecorded ? Math.round((totalPresent / totalRecorded) * 1000) / 10 : 0;

  function exportExcel() {
    if (students.length === 0) {
      toast.error("No hay estudiantes para exportar en este curso.");
      return;
    }
    const header = [
      "N° Lista",
      "RUN/IPE",
      "Apellido Paterno",
      "Apellido Materno",
      "Nombres",
      ...days.map((d) => Number(d.slice(-2))),
      "Días Asistidos",
      "Días Ausentes",
      "% Asistencia",
    ];
    const rows = summary.map((s) => [
      s.list_number ?? "",
      s.run_ipe ?? "",
      s.apellido_paterno,
      s.apellido_materno ?? "",
      s.nombres,
      ...days.map((d) => {
        const st = byStudentDay.get(`${s.id}|${d}`);
        return st ? (CODE[st] ?? "") : "";
      }),
      s.present,
      s.absent,
      s.pct,
    ]);
    const meta = [
      [`Establecimiento: Escuela Paihuen`],
      [`Curso: ${course?.name ?? ""} · Nivel: ${course?.level ?? ""}`],
      [`Período: ${MONTHS[month - 1]} ${year}`],
      [`Días hábiles del mes: ${days.length}`],
      [],
    ];
    const sheet = XLSX.utils.aoa_to_sheet([...meta, header, ...rows]);
    sheet["!cols"] = [
      { wch: 8 },
      { wch: 14 },
      { wch: 18 },
      { wch: 18 },
      { wch: 22 },
      ...days.map(() => ({ wch: 4 })),
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
    ];
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Asistencia SIGE");
    XLSX.writeFile(
      book,
      `asistencia-sige-${(course?.name ?? "curso").replace(/\s+/g, "-").toLowerCase()}-${year}-${String(month).padStart(2, "0")}.xlsx`,
    );
    toast.success("Planilla Excel generada");
  }

  const years = Array.from({ length: 6 }, (_, i) => now.getFullYear() - 4 + i);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-heading">Revisión Pre-SIGE y exportación</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Revisa mes a mes lo registrado por curso, corrige omisiones y descarga la planilla.
          </p>
        </div>
        <Button onClick={exportExcel}>
          <Download className="mr-1 size-4" /> Descargar Excel SIGE
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={activeCourse} onValueChange={setCourseId}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Curso" />
          </SelectTrigger>
          <SelectContent>
            {(courses.data ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name} · {c.level}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTHS.map((m, i) => (
              <SelectItem key={m} value={String(i + 1)}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Días hábiles" value={days.length} />
        <Stat label="Estudiantes" value={students.length} />
        <Stat label="Asistencia del curso" value={`${coursePct}%`} />
        <Stat label="Días con omisiones" value={missingDays.length + incompleteDays.length} />
      </div>

      {(missingDays.length > 0 || incompleteDays.length > 0) && (
        <div className="rounded-xl border border-accent/50 bg-accent/10 p-4 text-sm">
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="size-4 text-accent" /> Revisa antes de cargar en SIGE
          </p>
          {missingDays.length > 0 && (
            <p className="mt-2 text-muted-foreground">
              Días sin ningún registro: {missingDays.map((d) => Number(d.slice(-2))).join(", ")}
            </p>
          )}
          {incompleteDays.length > 0 && (
            <p className="mt-1 text-muted-foreground">
              Días incompletos: {incompleteDays.map((d) => Number(d.slice(-2))).join(", ")}
            </p>
          )}
        </div>
      )}

      <div className="surface-panel overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">N°</TableHead>
              <TableHead className="min-w-48">Estudiante</TableHead>
              {days.map((d) => (
                <TableHead key={d} className="px-1 text-center text-xs">
                  {Number(d.slice(-2))}
                </TableHead>
              ))}
              <TableHead className="text-center">Asist.</TableHead>
              <TableHead className="text-center">Aus.</TableHead>
              <TableHead className="text-center">%</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.isLoading && (
              <TableRow>
                <TableCell colSpan={days.length + 5} className="py-8 text-center text-muted-foreground">
                  Cargando período…
                </TableCell>
              </TableRow>
            )}
            {!data.isLoading && students.length === 0 && (
              <TableRow>
                <TableCell colSpan={days.length + 5} className="py-8 text-center text-muted-foreground">
                  Sin estudiantes en este curso.
                </TableCell>
              </TableRow>
            )}
            {summary.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{s.list_number ?? "—"}</TableCell>
                <TableCell className="font-medium">{fullName(s)}</TableCell>
                {days.map((d) => {
                  const st = byStudentDay.get(`${s.id}|${d}`);
                  return (
                    <TableCell key={d} className="px-1 text-center text-xs">
                      {st === "presente" && <span className="text-primary">P</span>}
                      {st === "justificado" && <span className="text-accent">J</span>}
                      {st === "ausente" && <span className="text-destructive">A</span>}
                      {!st && <span className="text-muted-foreground">·</span>}
                    </TableCell>
                  );
                })}
                <TableCell className="text-center">{s.present}</TableCell>
                <TableCell className="text-center">{s.absent}</TableCell>
                <TableCell className="text-center">
                  {s.missing > 0 ? (
                    <Badge variant="outline">{s.pct}%</Badge>
                  ) : (
                    <span>{s.pct}%</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        P = presente · J = justificado (cuenta como asistencia) · A = ausente · · = sin registro
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
