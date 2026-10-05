import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, ShieldCheck, Trash2 } from "lucide-react";
import { backend } from "@/integrations/backend/client";
import { useRole } from "@/lib/role";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/StudentForm";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const BLOOD_TYPES = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];

export function ProtectedDataBadge() {
  return (
    <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
      <ShieldCheck className="mr-1 size-3.5" />
      Datos Sensibles Protegidos - Ley N.º 21.719
    </Badge>
  );
}

export function HealthPanel({ studentId }: { studentId: string }) {
  const qc = useQueryClient();
  const { canEditHealth, canDeleteHealth } = useRole();

  const record = useQuery({
    queryKey: ["health", studentId],
    queryFn: async () => {
      const [rec, allergies, conditions, contacts] = await Promise.all([
        backend.from("health_records").select("*").eq("student_id", studentId).maybeSingle(),
        backend.from("health_allergies").select("*").eq("student_id", studentId).order("name"),
        backend.from("health_conditions").select("*").eq("student_id", studentId).order("name"),
        backend.from("emergency_contacts").select("*").eq("student_id", studentId).order("name"),
      ]);
      if (rec.error) throw rec.error;
      return {
        blood_type: rec.data?.blood_type ?? "",
        allergies: allergies.data ?? [],
        conditions: conditions.data ?? [],
        contacts: contacts.data ?? [],
      };
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["health", studentId] });

  const saveBlood = useMutation({
    mutationFn: async (blood_type: string) => {
      const { error } = await backend
        .from("health_records")
        .upsert({ student_id: studentId, blood_type }, { onConflict: "student_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      toast.success("Tipo de sangre actualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addRow = useMutation({
    mutationFn: async ({ table, values }: { table: string; values: Record<string, unknown> }) => {
      const { error } = await backend
        .from(table as "health_allergies")
        .insert({ student_id: studentId, ...values } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      toast.success("Registro agregado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeRow = useMutation({
    mutationFn: async ({ table, id }: { table: string; id: string }) => {
      const { error } = await backend
        .from(table as "health_allergies")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      toast.success("Registro eliminado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [allergy, setAllergy] = useState({ name: "", severity: "Media" });
  const [condition, setCondition] = useState({ name: "", notes: "" });
  const [contact, setContact] = useState({ name: "", relationship: "", phone: "" });

  if (record.isLoading) return <p className="text-sm text-muted-foreground">Cargando ficha…</p>;
  const data = record.data!;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ProtectedDataBadge />
        {!canEditHealth && (
          <span className="text-xs text-muted-foreground">
            Tu perfil actual tiene acceso solo de lectura.
          </span>
        )}
      </div>

      <div className="grid gap-4 sm:max-w-xs">
        <Field label="Tipo de sangre">
          <Select
            value={data.blood_type || "none"}
            disabled={!canEditHealth}
            onValueChange={(v) => saveBlood.mutate(v === "none" ? "" : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sin registrar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin registrar</SelectItem>
              {BLOOD_TYPES.map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <ListBlock
        title="Alergias"
        empty="Sin alergias registradas."
        items={data.allergies.map((a) => ({
          id: a.id,
          primary: a.name,
          secondary: a.severity ? `Severidad: ${a.severity}` : null,
        }))}
        canDelete={canDeleteHealth}
        onDelete={(id) => removeRow.mutate({ table: "health_allergies", id })}
        form={
          canEditHealth && (
            <div className="flex flex-wrap items-end gap-2">
              <Input
                placeholder="Alergia"
                className="max-w-48"
                value={allergy.name}
                onChange={(e) => setAllergy({ ...allergy, name: e.target.value })}
              />
              <Select
                value={allergy.severity}
                onValueChange={(v) => setAllergy({ ...allergy, severity: v })}
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["Baja", "Media", "Alta"].map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  if (!allergy.name.trim()) return;
                  addRow.mutate({ table: "health_allergies", values: allergy });
                  setAllergy({ name: "", severity: "Media" });
                }}
              >
                <Plus className="mr-1 size-4" /> Agregar
              </Button>
            </div>
          )
        }
      />

      <ListBlock
        title="Condiciones preexistentes"
        empty="Sin condiciones registradas."
        items={data.conditions.map((c) => ({
          id: c.id,
          primary: c.name,
          secondary: c.notes,
        }))}
        canDelete={canDeleteHealth}
        onDelete={(id) => removeRow.mutate({ table: "health_conditions", id })}
        form={
          canEditHealth && (
            <div className="flex flex-wrap items-end gap-2">
              <Input
                placeholder="Condición"
                className="max-w-48"
                value={condition.name}
                onChange={(e) => setCondition({ ...condition, name: e.target.value })}
              />
              <Input
                placeholder="Indicaciones"
                className="max-w-64"
                value={condition.notes}
                onChange={(e) => setCondition({ ...condition, notes: e.target.value })}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  if (!condition.name.trim()) return;
                  addRow.mutate({ table: "health_conditions", values: condition });
                  setCondition({ name: "", notes: "" });
                }}
              >
                <Plus className="mr-1 size-4" /> Agregar
              </Button>
            </div>
          )
        }
      />

      <ListBlock
        title="Contactos de emergencia"
        empty="Sin contactos registrados."
        items={data.contacts.map((c) => ({
          id: c.id,
          primary: c.name,
          secondary: [c.relationship, c.phone].filter(Boolean).join(" · ") || null,
        }))}
        canDelete={canDeleteHealth}
        onDelete={(id) => removeRow.mutate({ table: "emergency_contacts", id })}
        form={
          canEditHealth && (
            <div className="flex flex-wrap items-end gap-2">
              <Input
                placeholder="Nombre"
                className="max-w-48"
                value={contact.name}
                onChange={(e) => setContact({ ...contact, name: e.target.value })}
              />
              <Input
                placeholder="Parentesco"
                className="max-w-40"
                value={contact.relationship}
                onChange={(e) => setContact({ ...contact, relationship: e.target.value })}
              />
              <Input
                placeholder="Teléfono"
                className="max-w-40"
                value={contact.phone}
                onChange={(e) => setContact({ ...contact, phone: e.target.value })}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  if (!contact.name.trim()) return;
                  addRow.mutate({ table: "emergency_contacts", values: contact });
                  setContact({ name: "", relationship: "", phone: "" });
                }}
              >
                <Plus className="mr-1 size-4" /> Agregar
              </Button>
            </div>
          )
        }
      />
    </div>
  );
}

function ListBlock({
  title,
  empty,
  items,
  form,
  canDelete,
  onDelete,
}: {
  title: string;
  empty: string;
  items: { id: string; primary: string; secondary?: string | null }[];
  form: React.ReactNode;
  canDelete: boolean;
  onDelete: (id: string) => void;
}) {
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <h4 className="font-display text-base font-semibold">{title}</h4>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3 py-2">
              <span>
                <span className="block text-sm font-medium">{i.primary}</span>
                {i.secondary && (
                  <span className="block text-xs text-muted-foreground">{i.secondary}</span>
                )}
              </span>
              {canDelete && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Eliminar ${i.primary}`}
                  onClick={() => onDelete(i.id)}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {form}
    </section>
  );
}
