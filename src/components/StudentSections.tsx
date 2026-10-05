import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, Upload } from "lucide-react";

import { backend } from "@/integrations/backend/client";
import { MOVEMENT_TYPES, formatDateLong, toIsoDate } from "@/lib/school";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/StudentForm";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type StudentDoc = {
  id: string;
  speech_test_url: string | null;
  speech_test_name: string | null;
  guardian_interview: string | null;
};

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

export function SpeechTestSection({
  student,
  canEdit,
}: {
  student: StudentDoc;
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);

  async function uploadSpeechTest(file: File) {
    setUploading(true);
    try {
      const path = `${student.id}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
      const up = await backend.storage.from("documentos-matricula").upload(path, file);
      if (up.error) throw up.error;
      const { error } = await backend
        .from("students")
        .update({ speech_test_url: path, speech_test_name: file.name })
        .eq("id", student.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["student", student.id] });
      qc.invalidateQueries({ queryKey: ["student-registry"] });
      toast.success("Documento cargado");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="surface-panel space-y-4 p-6">
      <h2 className="font-display text-lg font-semibold">
        Test de fonoaudiología (PDF o imagen)
      </h2>
      {student.speech_test_url ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={() => openSpeechTest(student.speech_test_url!)}>
            <FileText className="mr-1 size-4" />
            {student.speech_test_name ?? "Ver documento"}
          </Button>
          {canEdit && (
            <span className="text-xs text-muted-foreground">
              Puedes reemplazarlo cargando un archivo nuevo.
            </span>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Aún no se ha cargado el resultado.</p>
      )}
      {canEdit && (
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
  );
}

export function InterviewSection({
  student,
  canEdit,
}: {
  student: StudentDoc;
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const [interview, setInterview] = useState<string | null>(null);
  const interviewValue = interview ?? student.guardian_interview ?? "";

  const saveInterview = useMutation({
    mutationFn: async (text: string) => {
      const { error } = await backend
        .from("students")
        .update({ guardian_interview: text })
        .eq("id", student.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student", student.id] });
      qc.invalidateQueries({ queryKey: ["student-registry"] });
      toast.success("Entrevista guardada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="surface-panel space-y-4 p-6">
      <h2 className="font-display text-lg font-semibold">Entrevista a apoderados</h2>
      <Textarea
        rows={10}
        readOnly={!canEdit}
        value={interviewValue}
        onChange={(e) => setInterview(e.target.value)}
        placeholder="Registra aquí el detalle de la entrevista con el apoderado…"
      />
      {canEdit && (
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
  );
}

export function MovementsSection({
  studentId,
  canEdit,
}: {
  studentId: string;
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const [mov, setMov] = useState({
    movement_date: toIsoDate(new Date()),
    movement_type: MOVEMENT_TYPES[0] as string,
    reason: "",
    observations: "",
    responsible: "Jefa de UTP",
  });

  const movements = useQuery({
    queryKey: ["movements", studentId],
    queryFn: async () => {
      const { data, error } = await backend
        .from("student_movements")
        .select("*")
        .eq("student_id", studentId)
        .order("movement_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const addMovement = useMutation({
    mutationFn: async () => {
      const { error } = await backend.from("student_movements").insert({
        student_id: studentId,
        movement_date: mov.movement_date,
        movement_type: mov.movement_type,
        reason: mov.reason || null,
        observations: mov.observations || null,
        responsible: mov.responsible || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["movements", studentId] });
      setMov({ ...mov, reason: "", observations: "" });
      toast.success("Movimiento registrado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      {canEdit && (
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
    </div>
  );
}
