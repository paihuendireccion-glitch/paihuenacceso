import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, ShieldAlert, Trash2 } from "lucide-react";

import { UserInvitePanel } from "@/components/UserInvitePanel";

import { backend } from "@/integrations/backend/client";
import { useRole } from "@/lib/role";
import { LEVELS, ROLES, ROLE_LABEL, type Role } from "@/lib/school";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Administración · Gestión Escolar Paihuen" },
      {
        name: "description",
        content:
          "Crea cursos, asigna educadoras y gestiona los roles del equipo de la Escuela Paihuen.",
      },
      { property: "og:title", content: "Administración · Gestión Escolar Paihuen" },
      {
        property: "og:description",
        content: "Panel para cursos, educadoras y roles del equipo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

const NONE = "__none__";

type ProfileRow = { id: string; full_name: string | null; email: string | null };

function AdminPage() {
  const { isAdmin, loading, user } = useRole();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [level, setLevel] = useState<string>(LEVELS[1]);
  const [teacherId, setTeacherId] = useState<string>(NONE);

  const people = useQuery({
    queryKey: ["admin-people"],
    enabled: isAdmin,
    queryFn: async () => {
      const [profileRes, roleRes] = await Promise.all([
        backend.from("profiles").select("id, full_name, email").order("created_at"),
        backend.from("user_roles").select("user_id, role"),
      ]);
      if (profileRes.error) throw profileRes.error;
      if (roleRes.error) throw roleRes.error;
      const roles = new Map<string, Role>();
      for (const r of roleRes.data ?? []) roles.set(r.user_id, r.role as Role);
      return (profileRes.data ?? []).map((p: ProfileRow) => ({
        ...p,
        role: roles.get(p.id) ?? ("apoderado" as Role),
      }));
    },
  });

  const courses = useQuery({
    queryKey: ["admin-courses"],
    enabled: isAdmin,
    queryFn: async () => {
      const [courseRes, studentRes] = await Promise.all([
        backend
          .from("courses")
          .select("id, name, level, teacher_name, teacher_profile_id, is_sample")
          .order("name"),
        backend.from("students").select("id, course_id"),
      ]);
      if (courseRes.error) throw courseRes.error;
      const counts = new Map<string, number>();
      for (const s of studentRes.data ?? []) {
        if (s.course_id) counts.set(s.course_id, (counts.get(s.course_id) ?? 0) + 1);
      }
      return (courseRes.data ?? []).map((c) => ({ ...c, students: counts.get(c.id) ?? 0 }));
    },
  });

  const teachers = (people.data ?? []).filter((p) => p.role !== "apoderado");

  function teacherLabel(id: string | null) {
    const p = (people.data ?? []).find((x) => x.id === id);
    return p ? (p.full_name?.trim() || p.email || "Sin nombre") : null;
  }

  const createCourse = useMutation({
    mutationFn: async () => {
      const assigned = teacherId === NONE ? null : teacherId;
      const { error } = await backend.from("courses").insert({
        name: name.trim(),
        level,
        teacher_profile_id: assigned,
        teacher_name: assigned ? teacherLabel(assigned) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Curso creado");
      setName("");
      setTeacherId(NONE);
      void queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error("No se pudo crear el curso", { description: e.message }),
  });

  const assignTeacher = useMutation({
    mutationFn: async ({ courseId, profileId }: { courseId: string; profileId: string | null }) => {
      const { error } = await backend
        .from("courses")
        .update({
          teacher_profile_id: profileId,
          teacher_name: profileId ? teacherLabel(profileId) : null,
        })
        .eq("id", courseId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Educadora asignada");
      void queryClient.invalidateQueries({ queryKey: ["admin-courses"] });
      void queryClient.invalidateQueries({ queryKey: ["courses"] });
    },
    onError: (e: Error) => toast.error("No se pudo asignar", { description: e.message }),
  });

  const deleteCourse = useMutation({
    mutationFn: async (courseId: string) => {
      const detach = await backend
        .from("students")
        .update({ course_id: null })
        .eq("course_id", courseId);
      if (detach.error) throw detach.error;
      const { error } = await backend.from("courses").delete().eq("id", courseId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Curso eliminado");
      void queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error("No se pudo eliminar", { description: e.message }),
  });

  const changeRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: Role }) => {
      const del = await backend.from("user_roles").delete().eq("user_id", userId);
      if (del.error) throw del.error;
      const { error } = await backend.from("user_roles").insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rol actualizado");
      void queryClient.invalidateQueries({ queryKey: ["admin-people"] });
    },
    onError: (e: Error) => toast.error("No se pudo cambiar el rol", { description: e.message }),
  });

  const deleteSample = useMutation({
    mutationFn: async () => {
      const sampleStudents = await backend.from("students").select("id").eq("is_sample", true);
      if (sampleStudents.error) throw sampleStudents.error;
      const ids = (sampleStudents.data ?? []).map((s) => s.id);
      if (ids.length) {
        for (const table of [
          "attendance",
          "student_movements",
          "health_allergies",
          "health_conditions",
          "emergency_contacts",
          "health_records",
          "guardians",
        ] as const) {
          const res = await backend.from(table).delete().in("student_id", ids);
          if (res.error) throw res.error;
        }
        const del = await backend.from("students").delete().in("id", ids);
        if (del.error) throw del.error;
      }
      const sampleCourses = await backend.from("courses").select("id").eq("is_sample", true);
      if (sampleCourses.error) throw sampleCourses.error;
      const courseIds = (sampleCourses.data ?? []).map((c) => c.id);
      if (courseIds.length) {
        const att = await backend.from("attendance").delete().in("course_id", courseIds);
        if (att.error) throw att.error;
        const stu = await backend
          .from("students")
          .update({ course_id: null })
          .in("course_id", courseIds);
        if (stu.error) throw stu.error;
        const del = await backend.from("courses").delete().in("id", courseIds);
        if (del.error) throw del.error;
      }
    },
    onSuccess: () => {
      toast.success("Datos de ejemplo eliminados");
      void queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error("No se pudieron eliminar", { description: e.message }),
  });

  if (loading) {
    return <p className="text-sm text-muted-foreground">Cargando…</p>;
  }

  if (!isAdmin) {
    return (
      <div className="surface-panel mx-auto max-w-lg p-8 text-center">
        <ShieldAlert className="mx-auto size-8 text-primary" />
        <h1 className="page-heading mt-4 text-xl">Sin permisos</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Solo el perfil Encargado / Administrador puede abrir el panel de administración. Pide a
          quien administra el sistema que cambie tu rol.
        </p>
      </div>
    );
  }

  const sampleCount =
    (courses.data ?? []).filter((c) => c.is_sample).length > 0
      ? (courses.data ?? []).filter((c) => c.is_sample).length
      : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-heading">Administración</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Crea los cursos del establecimiento, asigna la educadora responsable y define el rol de
          cada integrante del equipo.
        </p>
      </div>

      <Tabs defaultValue="cursos">
        <TabsList>
          <TabsTrigger value="cursos">Cursos</TabsTrigger>
          <TabsTrigger value="usuarios">Usuarios y roles</TabsTrigger>
          <TabsTrigger value="datos">Datos de ejemplo</TabsTrigger>
        </TabsList>

        <TabsContent value="cursos" className="space-y-6">
          <form
            className="surface-panel grid gap-4 p-6 md:grid-cols-[1fr_180px_1fr_auto] md:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              createCourse.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="course-name">Nombre del curso</Label>
              <Input
                id="course-name"
                placeholder="Ej: NT1 A"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Nivel</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEVELS.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Educadora responsable</Label>
              <Select value={teacherId} onValueChange={setTeacherId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sin asignar</SelectItem>
                  {teachers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.full_name?.trim() || t.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={createCourse.isPending}>
              <Plus className="size-4" />
              Crear curso
            </Button>
          </form>

          <div className="surface-panel overflow-x-auto p-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Curso</TableHead>
                  <TableHead>Nivel</TableHead>
                  <TableHead>Educadora asignada</TableHead>
                  <TableHead className="text-center">Estudiantes</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(courses.data ?? []).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      {c.name}
                      {c.is_sample && (
                        <Badge variant="outline" className="ml-2">
                          ejemplo
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{c.level}</TableCell>
                    <TableCell>
                      <Select
                        value={c.teacher_profile_id ?? NONE}
                        onValueChange={(v) =>
                          assignTeacher.mutate({
                            courseId: c.id,
                            profileId: v === NONE ? null : v,
                          })
                        }
                      >
                        <SelectTrigger className="w-56">
                          <SelectValue placeholder="Sin asignar" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>Sin asignar</SelectItem>
                          {teachers.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.full_name?.trim() || t.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!c.teacher_profile_id && c.teacher_name && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Registro anterior: {c.teacher_name}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-center">{c.students}</TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={`Eliminar ${c.name}`}>
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar el curso {c.name}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Los {c.students} estudiantes del curso quedarán sin curso asignado,
                              pero no se eliminan sus fichas.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteCourse.mutate(c.id)}>
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
                {(courses.data ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                      Aún no hay cursos creados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="usuarios" className="space-y-4">
          <UserInvitePanel courses={(courses.data ?? []).map((c) => ({ id: c.id, name: c.name, level: c.level }))} />
          <div className="surface-panel overflow-x-auto p-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Correo</TableHead>
                  <TableHead>Cursos a cargo</TableHead>
                  <TableHead>Rol</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(people.data ?? []).map((p) => {
                  const assigned = (courses.data ?? [])
                    .filter((c) => c.teacher_profile_id === p.id)
                    .map((c) => c.name);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        {p.full_name?.trim() || "Sin nombre"}
                        {p.id === user?.id && (
                          <Badge variant="outline" className="ml-2">
                            tú
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{p.email}</TableCell>
                      <TableCell>{assigned.length ? assigned.join(", ") : "—"}</TableCell>
                      <TableCell>
                        <Select
                          value={p.role}
                          disabled={p.id === user?.id}
                          onValueChange={(v) =>
                            changeRole.mutate({ userId: p.id, role: v as Role })
                          }
                        >
                          <SelectTrigger className="w-64">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLES.map((r) => (
                              <SelectItem key={r} value={r}>
                                {ROLE_LABEL[r]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="datos">
          <div className="surface-panel space-y-4 p-6">
            <div>
              <h2 className="font-display text-lg font-semibold">Datos de ejemplo</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Los cursos y estudiantes cargados para la demostración están marcados como
                “ejemplo”. Cuando ya tengas tus propios datos, puedes eliminarlos junto con su
                asistencia y fichas de salud.
              </p>
            </div>
            <p className="text-sm">
              Cursos de ejemplo actuales: <span className="font-semibold">{sampleCount}</span>
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={deleteSample.isPending}>
                  <Trash2 className="size-4" />
                  Eliminar todos los datos de ejemplo
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Eliminar los datos de ejemplo?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Se eliminarán los cursos y estudiantes de ejemplo con su asistencia, fichas de
                    salud, apoderados y movimientos. Esta acción no se puede deshacer. Tus propios
                    registros no se tocan.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteSample.mutate()}>
                    Eliminar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
