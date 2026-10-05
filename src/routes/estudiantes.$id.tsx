import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, FileText, Upload } from "lucide-react";
import { backend } from "@/integrations/backend/client";
import { MOVEMENT_TYPES, formatDateLong, fullName, toIsoDate } from "@/lib/school";
import { useRole } from "@/lib/role";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StudentForm, Field } from "@/components/StudentForm";
import { HealthPanel } from "@/components/HealthPanel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/estudiantes/$id")({
  head: () => ({
    meta: [
      { title: "Ficha del estudiante — Escuela Paihuen" },
      {
        name: "description",
        content:
          "Ficha del estudiante: datos de matrícula, apoderado, documentos, historial de movimientos y salud escolar.",
      },
      { property: "og:title", content: "Ficha del estudiante" },
      {
        property: "og:description",
        content: "Datos de matrícula, movimientos y ficha de salud del estudiante.",
      },
    ],
  }),
  component: StudentDetail,
});

function StudentDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { canEditStudents } = useRole();

  const student = useQuery({
    queryKey: ["student", id],
    queryFn: async () => {
      const { data, error } = await backend
        .from("students")
        .select("*, courses(name, level)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const guardian = useQuery({
    queryKey: ["guardian", id],
    queryFn: async () => {
      const { data, error } = await backend
        .from("guardians")
        .select("*")
        .eq("student_id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const movements = useQuery({
    queryKey: ["movements", id],
    queryFn: async () => {
      const { data, error } = await backend
        .from("student_movements")
        .select("*")
        .eq("student_id", id)
        .order("movement_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const [interview, setInterview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [mov, setMov] = useState({
    movement_date: toIsoDate(new Date()),
    movement_type: MOVEMENT_TYPES[0] as string,
    reason: "",
    observations: "",
    responsible: "Jefa de UTP",
  });

  const saveInterview = useMutation({
    mutationFn: async (text: string) => {
      const { error } = await backend
        .from("students")
        .update({ guardian_interview: text })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student", id] });
      toast.success("Entrevista guardada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addMovement = useMutation({
    mutationFn: async () => {
      const { error } = await backend.from("student_movements").insert({
        student_id: id,
        movement_date: mov.movement_date,
        movement_type: mov.movement_type,
        reason: mov.reason || null,
        observations: mov.observations || null,
        responsible: mov.responsible || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["movements", id] });
      setMov({ ...mov, reason: "", observations: "" });
      toast.success("Movimiento registrado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function uploadSpeechTest(file: File) {
    setUploading(true);
    try {
      const path = `${id}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
      const up = await backend.storage.from("documentos-matricula").upload(path, file);
      if (up.error) throw up.error;
      const { error } = await backend
        .from("students")
        .update({ speech_test_url: path, speech_test_name: file.name })
        .eq("id", id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["student", id] });
      toast.success("Documento cargado");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function openSpeechTest(path: string) {
    const { data, error } = await backend.storage
      .from("documentos-matricula")
      .createSignedUrl(path, 300);
    if (error || !data) {
      toast.error("No se pudo abrir el documento");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  if (student.isLoading) return <p className="text-muted-foreground">Cargando ficha…</p>;
  if (!student.data) return <p className="text-muted-foreground">Estudiante no encontrado.</p>;
  const s = student.data;
  const interviewValue = interview ?? s.guardian_interview ?? "";

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link to="/estudiantes">
          <ArrowLeft className="mr-1 size-4" /> Volver al listado
        </Link>
      </Button>

      <header className="surface-panel flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <h1 className="page-heading">{fullName(s)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {s.level} · {s.courses?.name ?? "Sin curso"} · Matrícula {s.enrollment_number ?? "—"} ·
            RUN {s.run_ipe ?? "—"}
          </p>
        </div>
        {s.nee_full_support && (
          <Badge className="bg-accent text-accent-foreground hover:bg-accent">
            N.E.E. apoyo completo
          </Badge>
        )}
      </header>

      <Tabs defaultValue="datos">
        <TabsList>
          <TabsTrigger value="datos">Datos</TabsTrigger>
          <TabsTrigger value="matricula">Proceso de matrícula</TabsTrigger>
          <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
          <TabsTrigger value="salud">Salud escolar</TabsTrigger>
        </TabsList>

        <TabsContent value="datos" className="mt-4">
          <div className="surface-panel p-6">
            <StudentForm student={s} />
          </div>
          {guardian.data && (
            <p className="mt-3 text-xs text-muted-foreground">
              Contacto registrado: {guardian.data.phone ?? "sin teléfono"} ·{" "}
              {guardian.data.email ?? "sin correo"}
            </p>
          )}
        </TabsContent>

        <TabsContent value="matricula" className="mt-4 space-y-6">
          <section className="surface-panel space-y-4 p-6">
            <h2 className="font-display text-lg font-semibold">
              Test de fonoaudiología (PDF o imagen)
            </h2>
            {s.speech_test_url ? (
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="secondary" onClick={() => openSpeechTest(s.speech_test_url!)}>
                  <FileText className="mr-1 size-4" />
                  {s.speech_test_name ?? "Ver documento"}
                </Button>
                <span className="text-xs text-muted-foreground">
                  Puedes reemplazarlo cargando un archivo nuevo.
                </span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aún no se ha cargado el resultado.</p>
            )}
            {canEditStudents && (
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-4 py-3 text-sm font-medium text-primary">
                <Upload className="size-4" />
                {uploading ? "Cargando…" : "Cargar archivo"}
                <input
                  type="file"
                  className="hidden"
                  accept="application/pdf,image/*"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadSpeechTest(file);
                  }}
                />
              </label>
            )}
          </section>

          <section className="surface-panel space-y-4 p-6">
            <h2 className="font-display text-lg font-semibold">Entrevista a apoderados</h2>
            <Textarea
              rows={10}
              readOnly={!canEditStudents}
              value={interviewValue}
              onChange={(e) => setInterview(e.target.value)}
              placeholder="Registra aquí el detalle de la entrevista con el apoderado…"
            />
            {canEditStudents && (
              <div className="flex justify-end">
                <Button
                  onClick={() => saveInterview.mutate(interviewValue)}
                  disabled={saveInterview.isPending}
                >
                  Guardar entrevista
                </Button>
              </div>
            )}
          </section>
        </TabsContent>

        <TabsContent value="movimientos" className="mt-4 space-y-6">
          {canEditStudents && (
          <section className="surface-panel space-y-4 p-6">
            <h2 className="font-display text-lg font-semibold">Registrar movimiento</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Fecha del movimiento">
                <Input
                  type="date"
                  value={mov.movement_date}
                  onChange={(e) => setMov({ ...mov, movement_date: e.target.value })}
                />
              </Field>
              <Field label="Tipo de movimiento">
                <Select
                  value={mov.movement_type}
                  onValueChange={(v) => setMov({ ...mov, movement_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MOVEMENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Motivo del traslado">
                <Input
                  value={mov.reason}
                  onChange={(e) => setMov({ ...mov, reason: e.target.value })}
                />
              </Field>
              <Field label="Responsable del registro">
                <Input
                  value={mov.responsible}
                  onChange={(e) => setMov({ ...mov, responsible: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Observaciones">
              <Textarea
                rows={3}
                value={mov.observations}
                onChange={(e) => setMov({ ...mov, observations: e.target.value })}
              />
            </Field>
            <div className="flex justify-end">
              <Button onClick={() => addMovement.mutate()} disabled={addMovement.isPending}>
                Registrar movimiento
              </Button>
            </div>
          </section>
          )}

          <section className="surface-panel p-6">
            <h2 className="font-display text-lg font-semibold">Historial de movimientos</h2>
            {(movements.data ?? []).length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Sin movimientos registrados.</p>
            ) : (
              <ol className="mt-4 space-y-4 border-l border-border pl-5">
                {(movements.data ?? []).map((m) => (
                  <li key={m.id} className="relative">
                    <span className="absolute -left-[26px] top-1.5 size-3 rounded-full bg-primary" />
                    <p className="font-medium">{m.movement_type}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateLong(m.movement_date)} · Responsable: {m.responsible ?? "—"}
                    </p>
                    {m.reason && <p className="mt-1 text-sm">Motivo: {m.reason}</p>}
                    {m.observations && (
                      <p className="text-sm text-muted-foreground">{m.observations}</p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </TabsContent>

        <TabsContent value="salud" className="mt-4">
          <div className="surface-panel p-6">
            <HealthPanel studentId={id} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
