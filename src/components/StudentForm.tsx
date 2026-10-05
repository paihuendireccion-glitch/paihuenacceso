import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { backend } from "@/integrations/backend/client";
import { LEVELS, type Student } from "@/lib/school";
import { useRole } from "@/lib/role";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type GuardianForm = {
  id?: string;
  list_number: string;
  apellido_paterno: string;
  apellido_materno: string;
  nombres: string;
  address: string;
  comuna: string;
  phone: string;
  email: string;
  observations: string;
  relationship: string;
};

type SubForm = {
  full_name: string;
  rut: string;
  relationship: string;
  phone: string;
  email: string;
  address: string;
};

const emptySub: SubForm = { full_name: "", rut: "", relationship: "", phone: "", email: "", address: "" };

export const MARITAL_STATUS = ["Casados", "Separados", "Viudo/a", "Conviviente", "Soltera/o"] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const emptyGuardian: GuardianForm = {
  list_number: "",
  apellido_paterno: "",
  apellido_materno: "",
  nombres: "",
  address: "",
  comuna: "",
  phone: "",
  email: "",
  observations: "",
  relationship: "",
};

type Props = {
  student?: Student;
  onDone?: (studentId: string) => void;
};

export function StudentForm({ student, onDone }: Props) {
  const qc = useQueryClient();
  const { canEditStudents } = useRole();
  const readOnly = !canEditStudents;
  const [form, setForm] = useState({
    list_number: student?.list_number?.toString() ?? "",
    enrollment_number: student?.enrollment_number ?? "",
    level: student?.level ?? "NT1",
    course_id: student?.course_id ?? "",
    apellido_paterno: student?.apellido_paterno ?? "",
    apellido_materno: student?.apellido_materno ?? "",
    nombres: student?.nombres ?? "",
    run_ipe: student?.run_ipe ?? "",
    birth_date: student?.birth_date ?? "",
    sex: student?.sex ?? "",
    nee_full_support: student?.nee_full_support ?? false,
    address: student?.address ?? "",
    comuna: student?.comuna ?? "",
    parents_marital_status: (student as { parents_marital_status?: string | null } | undefined)?.parents_marital_status ?? "",
    lives_with: (student as { lives_with?: string | null } | undefined)?.lives_with ?? "",
    children_count: (student as { children_count?: number | null } | undefined)?.children_count?.toString() ?? "",
    sibling_position: (student as { sibling_position?: string | null } | undefined)?.sibling_position ?? "",
  });

  const { data: subRow } = useQuery({
    queryKey: ["substitute-guardian", student?.id],
    enabled: !!student?.id,
    queryFn: async () => {
      const { data, error } = await backend
        .from("substitute_guardians")
        .select("*")
        .eq("student_id", student!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const [subEdits, setSubEdits] = useState<Partial<SubForm>>({});
  const [subOpen, setSubOpen] = useState<boolean | null>(null);
  const showSub = subOpen ?? !!subRow;
  const sub: SubForm = {
    ...emptySub,
    ...(subRow
      ? {
          full_name: subRow.full_name,
          rut: subRow.rut,
          relationship: subRow.relationship,
          phone: subRow.phone,
          email: subRow.email ?? "",
          address: subRow.address ?? "",
        }
      : {}),
    ...subEdits,
  };
  const setS = (k: keyof SubForm, v: string) => setSubEdits((prev) => ({ ...prev, [k]: v }));

  const { data: courses } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const { data, error } = await backend.from("courses").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: guardianRow } = useQuery({
    queryKey: ["guardian", student?.id],
    enabled: !!student?.id,
    queryFn: async () => {
      const { data, error } = await backend
        .from("guardians")
        .select("*")
        .eq("student_id", student!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [guardianEdits, setGuardianEdits] = useState<Partial<GuardianForm>>({});
  const guardian: GuardianForm = {
    ...emptyGuardian,
    ...(guardianRow
      ? {
          id: guardianRow.id,
          list_number: guardianRow.list_number?.toString() ?? "",
          apellido_paterno: guardianRow.apellido_paterno ?? "",
          apellido_materno: guardianRow.apellido_materno ?? "",
          nombres: guardianRow.nombres ?? "",
          address: guardianRow.address ?? "",
          comuna: guardianRow.comuna ?? "",
          phone: guardianRow.phone ?? "",
          email: guardianRow.email ?? "",
          observations: guardianRow.observations ?? "",
          relationship: guardianRow.relationship ?? "",
        }
      : {}),
    ...guardianEdits,
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.apellido_paterno.trim() || !form.nombres.trim()) {
        throw new Error("El apellido paterno y los nombres son obligatorios.");
      }
      if (form.children_count && (!Number.isInteger(Number(form.children_count)) || Number(form.children_count) < 0)) {
        throw new Error("El número de hijos debe ser un número entero no negativo.");
      }
      if (guardian.email && !EMAIL_RE.test(guardian.email)) {
        throw new Error("El correo del apoderado no es válido.");
      }
      if (showSub) {
        if (!sub.full_name.trim() || !sub.rut.trim() || !sub.relationship.trim() || !sub.phone.trim()) {
          throw new Error("Completa nombre, RUT, parentesco y teléfono del apoderado suplente.");
        }
        if (sub.email && !EMAIL_RE.test(sub.email)) {
          throw new Error("El correo del apoderado suplente no es válido.");
        }
      }
      const payload = {
        list_number: form.list_number ? Number(form.list_number) : null,
        enrollment_number: form.enrollment_number || null,
        level: form.level,
        course_id: form.course_id || null,
        apellido_paterno: form.apellido_paterno.trim(),
        apellido_materno: form.apellido_materno.trim() || null,
        nombres: form.nombres.trim(),
        run_ipe: form.run_ipe.trim() || null,
        birth_date: form.birth_date || null,
        sex: form.sex || null,
        nee_full_support: form.nee_full_support,
        address: form.address.trim() || null,
        comuna: form.comuna.trim() || null,
        parents_marital_status: form.parents_marital_status || null,
        lives_with: form.lives_with.trim() || null,
        children_count: form.children_count ? Number(form.children_count) : null,
        sibling_position: form.sibling_position.trim() || null,
      };

      let studentId = student?.id;
      if (studentId) {
        const { error } = await backend.from("students").update(payload).eq("id", studentId);
        if (error) throw error;
      } else {
        const { data, error } = await backend
          .from("students")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        studentId = data.id;
      }

      const gPayload = {
        student_id: studentId!,
        list_number: guardian.list_number ? Number(guardian.list_number) : null,
        apellido_paterno: guardian.apellido_paterno || null,
        apellido_materno: guardian.apellido_materno || null,
        nombres: guardian.nombres || null,
        address: guardian.address || null,
        comuna: guardian.comuna || null,
        phone: guardian.phone || null,
        email: guardian.email || null,
        observations: guardian.observations || null,
        relationship: guardian.relationship || null,
      };
      const hasGuardianData = Object.values(gPayload).some(
        (v) => v !== null && v !== studentId && v !== "",
      );
      if (guardian.id) {
        const { error } = await backend.from("guardians").update(gPayload).eq("id", guardian.id);
        if (error) throw error;
      } else if (hasGuardianData) {
        const { error } = await backend.from("guardians").insert(gPayload);
        if (error) throw error;
      }
      if (showSub) {
        const sPayload = {
          student_id: studentId!,
          full_name: sub.full_name.trim(),
          rut: sub.rut.trim(),
          relationship: sub.relationship.trim(),
          phone: sub.phone.trim(),
          email: sub.email.trim() || null,
          address: sub.address.trim() || null,
        };
        const { error } = await backend
          .from("substitute_guardians")
          .upsert(sPayload, { onConflict: "student_id" });
        if (error) throw error;
      } else if (subRow) {
        const { error } = await backend.from("substitute_guardians").delete().eq("id", subRow.id);
        if (error) throw error;
      }
      return studentId!;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: ["student", id] });
      qc.invalidateQueries({ queryKey: ["guardian", id] });
      qc.invalidateQueries({ queryKey: ["substitute-guardian", id] });
      setSubEdits({});
      setSubOpen(null);
      toast.success(student ? "Ficha actualizada" : "Estudiante matriculado");
      onDone?.(id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = (k: keyof typeof form, v: string | boolean) =>
    setForm((prev) => ({ ...prev, [k]: v }));
  const setG = (k: keyof GuardianForm, v: string) =>
    setGuardianEdits((prev) => ({ ...prev, [k]: v }));

  return (
    <form
      className="space-y-8"
      onSubmit={(e) => {
        e.preventDefault();
        if (readOnly) return;
        save.mutate();
      }}
    >
      {readOnly && (
        <p className="rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          Tu perfil tiene acceso de solo lectura a los datos de matrícula y apoderados.
        </p>
      )}
      <fieldset disabled={readOnly} className="space-y-8 disabled:opacity-90">
      <section className="space-y-4">
        <h3 className="font-display text-lg font-semibold">Datos del alumno</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Número de lista">
            <Input
              type="number"
              value={form.list_number}
              onChange={(e) => set("list_number", e.target.value)}
            />
          </Field>
          <Field label="Número de matrícula">
            <Input
              value={form.enrollment_number}
              onChange={(e) => set("enrollment_number", e.target.value)}
            />
          </Field>
          <Field label="Nivel educativo">
            <Select value={form.level} onValueChange={(v) => set("level", v)}>
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
          </Field>
          <Field label="Curso">
            <Select
              value={form.course_id || "none"}
              onValueChange={(v) => set("course_id", v === "none" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sin curso" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin curso asignado</SelectItem>
                {(courses ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Apellido paterno *">
            <Input
              required
              value={form.apellido_paterno}
              onChange={(e) => set("apellido_paterno", e.target.value)}
            />
          </Field>
          <Field label="Apellido materno">
            <Input
              value={form.apellido_materno}
              onChange={(e) => set("apellido_materno", e.target.value)}
            />
          </Field>
          <Field label="Nombres *">
            <Input required value={form.nombres} onChange={(e) => set("nombres", e.target.value)} />
          </Field>
          <Field label="RUN / IPE">
            <Input value={form.run_ipe} onChange={(e) => set("run_ipe", e.target.value)} />
          </Field>
          <Field label="Fecha de nacimiento">
            <Input
              type="date"
              value={form.birth_date}
              onChange={(e) => set("birth_date", e.target.value)}
            />
          </Field>
          <Field label="Sexo">
            <Select value={form.sex || "none"} onValueChange={(v) => set("sex", v === "none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin especificar</SelectItem>
                <SelectItem value="Femenino">Femenino</SelectItem>
                <SelectItem value="Masculino">Masculino</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Dirección">
            <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
          </Field>
          <Field label="Comuna">
            <Input value={form.comuna} onChange={(e) => set("comuna", e.target.value)} />
          </Field>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 px-4 py-3">
          <Switch
            id="nee"
            checked={form.nee_full_support}
            onCheckedChange={(v) => set("nee_full_support", v)}
          />
          <Label htmlFor="nee" className="cursor-pointer">
            N.E.E. con apoyo completo
          </Label>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="font-display text-lg font-semibold">Antecedentes familiares</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Estado civil de los padres">
            <Select
              value={form.parents_marital_status || "none"}
              onValueChange={(v) => set("parents_marital_status", v === "none" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin información</SelectItem>
                {MARITAL_STATUS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="El niño/a vive con">
            <Input
              value={form.lives_with}
              placeholder="Ej.: Madre y abuela"
              onChange={(e) => set("lives_with", e.target.value)}
            />
          </Field>
          <Field label="N.º de hijos">
            <Input
              type="number"
              min={0}
              step={1}
              value={form.children_count}
              onChange={(e) => set("children_count", e.target.value)}
            />
          </Field>
          <Field label="Lugar que ocupa entre los hermanos">
            <Input
              value={form.sibling_position}
              placeholder="Ej.: Mayor, 2.º de 3"
              onChange={(e) => set("sibling_position", e.target.value)}
            />
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="font-display text-lg font-semibold">Datos del apoderado</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Número de lista">
            <Input
              type="number"
              value={guardian.list_number}
              onChange={(e) => setG("list_number", e.target.value)}
            />
          </Field>
          <Field label="Apellido paterno">
            <Input
              value={guardian.apellido_paterno}
              onChange={(e) => setG("apellido_paterno", e.target.value)}
            />
          </Field>
          <Field label="Apellido materno">
            <Input
              value={guardian.apellido_materno}
              onChange={(e) => setG("apellido_materno", e.target.value)}
            />
          </Field>
          <Field label="Nombres">
            <Input value={guardian.nombres} onChange={(e) => setG("nombres", e.target.value)} />
          </Field>
          <Field label="Dirección">
            <Input value={guardian.address} onChange={(e) => setG("address", e.target.value)} />
          </Field>
          <Field label="Comuna">
            <Input value={guardian.comuna} onChange={(e) => setG("comuna", e.target.value)} />
          </Field>
          <Field label="Teléfono">
            <Input value={guardian.phone} onChange={(e) => setG("phone", e.target.value)} />
          </Field>
          <Field label="Parentesco o relación">
            <Input
              value={guardian.relationship}
              placeholder="Ej.: Madre, Padre, Abuela"
              onChange={(e) => setG("relationship", e.target.value)}
            />
          </Field>
          <Field label="Correo electrónico">
            <Input
              type="email"
              value={guardian.email}
              onChange={(e) => setG("email", e.target.value)}
            />
          </Field>
        </div>
        <Field label="Observaciones">
          <Textarea
            rows={3}
            value={guardian.observations}
            onChange={(e) => setG("observations", e.target.value)}
          />
        </Field>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-lg font-semibold">Apoderado suplente</h3>
          {!readOnly && (
            <Button
              type="button"
              variant={showSub ? "ghost" : "secondary"}
              size="sm"
              onClick={() => setSubOpen(!showSub)}
            >
              {showSub ? "Quitar apoderado suplente" : "Agregar apoderado suplente"}
            </Button>
          )}
        </div>
        {showSub ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Nombre completo *">
              <Input value={sub.full_name} onChange={(e) => setS("full_name", e.target.value)} />
            </Field>
            <Field label="RUT *">
              <Input value={sub.rut} onChange={(e) => setS("rut", e.target.value)} />
            </Field>
            <Field label="Parentesco o relación *">
              <Input value={sub.relationship} onChange={(e) => setS("relationship", e.target.value)} />
            </Field>
            <Field label="Teléfono de contacto *">
              <Input value={sub.phone} onChange={(e) => setS("phone", e.target.value)} />
            </Field>
            <Field label="Correo electrónico (opcional)">
              <Input type="email" value={sub.email} onChange={(e) => setS("email", e.target.value)} />
            </Field>
            <Field label="Dirección (opcional)">
              <Input value={sub.address} onChange={(e) => setS("address", e.target.value)} />
            </Field>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No hay apoderado suplente registrado.</p>
        )}
        {!readOnly && subRow && !showSub && (
          <p className="text-xs text-muted-foreground">
            El apoderado suplente se eliminará al guardar los cambios.
          </p>
        )}
      </section>
      </fieldset>

      {!readOnly && (
        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? "Guardando…" : student ? "Guardar cambios" : "Matricular estudiante"}
          </Button>
        </div>
      )}
    </form>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
