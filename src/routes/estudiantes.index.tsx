import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { backend } from "@/integrations/backend/client";
import { LEVELS, fullName } from "@/lib/school";
import { useRole } from "@/lib/role";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { StudentForm } from "@/components/StudentForm";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/estudiantes/")({
  head: () => ({
    meta: [
      { title: "Matrícula y seguimiento de estudiantes — Escuela Paihuen" },
      {
        name: "description",
        content:
          "Registro de matrícula con datos del alumno y apoderado, test de fonoaudiología, entrevista e historial de movimientos.",
      },
      { property: "og:title", content: "Matrícula y seguimiento de estudiantes" },
      {
        property: "og:description",
        content: "Ficha digital de matrícula con historial de movimientos del estudiante.",
      },
    ],
  }),
  component: StudentsPage,
});

function StudentsPage() {
  const { canEditStudents } = useRole();
  const [q, setQ] = useState("");
  const [level, setLevel] = useState("todos");
  const [open, setOpen] = useState(false);

  const students = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const { data, error } = await backend
        .from("students")
        .select("*, courses(name)")
        .order("level")
        .order("list_number");
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = (students.data ?? []).filter((s) => {
    const matchesLevel = level === "todos" || s.level === level;
    const text = `${fullName(s)} ${s.run_ipe ?? ""} ${s.enrollment_number ?? ""}`.toLowerCase();
    return matchesLevel && text.includes(q.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-heading">Matrícula y seguimiento</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Fichas de estudiantes, apoderados y su historial de movimientos.
          </p>
        </div>
        {canEditStudents && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-1 size-4" /> Nueva matrícula
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-display text-2xl">Nueva matrícula</DialogTitle>
              </DialogHeader>
              <StudentForm onDone={() => setOpen(false)} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-56">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nombre, RUN o matrícula"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Select value={level} onValueChange={setLevel}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los niveles</SelectItem>
            {LEVELS.map((l) => (
              <SelectItem key={l} value={l}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="surface-panel overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">N° lista</TableHead>
              <TableHead>Estudiante</TableHead>
              <TableHead>RUN / IPE</TableHead>
              <TableHead>Nivel</TableHead>
              <TableHead>Curso</TableHead>
              <TableHead>N.E.E.</TableHead>
              <TableHead className="text-right">Ficha</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  Cargando estudiantes…
                </TableCell>
              </TableRow>
            )}
            {!students.isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  No hay estudiantes que coincidan con la búsqueda.
                </TableCell>
              </TableRow>
            )}
            {rows.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{s.list_number ?? "—"}</TableCell>
                <TableCell className="font-medium">{fullName(s)}</TableCell>
                <TableCell>{s.run_ipe ?? "—"}</TableCell>
                <TableCell>{s.level}</TableCell>
                <TableCell>{s.courses?.name ?? "Sin curso"}</TableCell>
                <TableCell>
                  {s.nee_full_support ? (
                    <Badge className="bg-accent text-accent-foreground hover:bg-accent">
                      Apoyo completo
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">No</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button asChild variant="secondary" size="sm">
                    <Link to="/estudiantes/$id" params={{ id: s.id }}>
                      Ver ficha
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
