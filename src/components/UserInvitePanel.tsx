import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { KeyRound, Mail, Plus, X } from "lucide-react";

import { backend } from "@/integrations/backend/client";
import { ROLES, ROLE_LABEL, type Role } from "@/lib/school";
import {
  cancelUserInvite,
  confirmUserInvite,
  requestUserInvite,
} from "@/lib/users.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NONE = "__none__";

type CourseOption = { id: string; name: string; level: string };

export function UserInvitePanel({ courses }: { courses: CourseOption[] }) {
  const qc = useQueryClient();
  const requestFn = useServerFn(requestUserInvite);
  const confirmFn = useServerFn(confirmUserInvite);
  const cancelFn = useServerFn(cancelUserInvite);

  const [fullName, setFullName] = useState("");
  const [rut, setRut] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("educadora");
  const [courseId, setCourseId] = useState(NONE);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);

  const pending = useQuery({
    queryKey: ["pending-users"],
    queryFn: async () => {
      const { data, error } = await backend
        .from("pending_users")
        .select("id, full_name, rut, email, role, course_id, expires_at, status, created_at")
        .eq("status", "pendiente")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const request = useMutation({
    mutationFn: async () =>
      requestFn({
        data: {
          fullName,
          rut,
          email,
          role,
          courseId: courseId === NONE ? null : courseId,
        },
      }),
    onSuccess: (res) => {
      toast.success("Solicitud creada", {
        description: res.emailSent
          ? "Enviamos el código al correo del Administrador."
          : "El código de confirmación aparece en la solicitud.",
      });
      if (!res.emailSent) setCodes((prev) => ({ ...prev, [res.id]: res.code }));
      setFullName("");
      setRut("");
      setEmail("");
      setCourseId(NONE);
      void qc.invalidateQueries({ queryKey: ["pending-users"] });
    },
    onError: (e: Error) => toast.error("No se pudo crear la solicitud", { description: e.message }),
  });

  const confirm = useMutation({
    mutationFn: async ({ id, code }: { id: string; code: string }) =>
      confirmFn({ data: { id, code } }),
    onSuccess: (res) => {
      setCredentials({ email: res.email, password: res.password });
      toast.success("Cuenta creada");
      void qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error("No se pudo confirmar", { description: e.message }),
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => cancelFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Solicitud cancelada");
      void qc.invalidateQueries({ queryKey: ["pending-users"] });
    },
    onError: (e: Error) => toast.error("No se pudo cancelar", { description: e.message }),
  });

  return (
    <div className="space-y-4">
      <form
        className="surface-panel space-y-4 p-6"
        onSubmit={(e) => {
          e.preventDefault();
          request.mutate();
        }}
      >
        <div>
          <h2 className="font-display text-lg font-semibold">Crear una cuenta nueva</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Completa los datos. Te entregaremos un código de un solo uso que debes ingresar para
            confirmar la creación de la cuenta.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="inv-name">Nombre completo</Label>
            <Input
              id="inv-name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inv-rut">RUT</Label>
            <Input
              id="inv-rut"
              placeholder="12.345.678-9"
              value={rut}
              onChange={(e) => setRut(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inv-email">Correo electrónico</Label>
            <Input
              id="inv-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Rol</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger>
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
          </div>
          <div className="space-y-2">
            <Label>Curso asignado</Label>
            <Select
              value={courseId}
              disabled={role !== "educadora"}
              onValueChange={setCourseId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sin asignar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sin asignar</SelectItem>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} · {c.level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={request.isPending}>
            <Plus className="size-4" />
            {request.isPending ? "Generando código…" : "Generar código y solicitar"}
          </Button>
        </div>
      </form>

      {credentials && (
        <div className="surface-panel space-y-2 p-6">
          <h3 className="font-display text-base font-semibold">Credenciales del nuevo usuario</h3>
          <p className="text-sm text-muted-foreground">
            Entrega estos datos a la persona. Debe cambiar la contraseña en su primer ingreso.
          </p>
          <p className="text-sm">
            Correo: <span className="font-medium">{credentials.email}</span>
          </p>
          <p className="text-sm">
            Contraseña temporal: <span className="font-mono font-medium">{credentials.password}</span>
          </p>
          <Button variant="secondary" size="sm" onClick={() => setCredentials(null)}>
            Listo
          </Button>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Solicitudes pendientes</h2>
        {pending.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
        {!pending.isLoading && (pending.data ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">No hay solicitudes pendientes.</p>
        )}
        {(pending.data ?? []).map((p) => (
          <PendingRow
            key={p.id}
            row={p}
            code={codes[p.id]}
            courses={courses}
            busy={confirm.isPending || cancel.isPending}
            onConfirm={(code) => confirm.mutate({ id: p.id, code })}
            onCancel={() => cancel.mutate(p.id)}
          />
        ))}
      </div>
    </div>
  );
}

type PendingRowData = {
  id: string;
  full_name: string;
  rut: string | null;
  email: string;
  role: string;
  course_id: string | null;
  expires_at: string;
};

function PendingRow({
  row,
  code,
  courses,
  busy,
  onConfirm,
  onCancel,
}: {
  row: PendingRowData;
  code?: string | undefined;
  courses: CourseOption[];
  busy: boolean;
  onConfirm: (code: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(code ?? "");
  const courseName = courses.find((c) => c.id === row.course_id)?.name;
  const expires = new Date(row.expires_at);
  const expired = expires.getTime() < Date.now();

  return (
    <div className="surface-panel flex flex-wrap items-end justify-between gap-4 p-5">
      <div className="space-y-1">
        <p className="font-medium">
          {row.full_name}
          <Badge variant="outline" className="ml-2">
            {ROLE_LABEL[row.role as Role] ?? row.role}
          </Badge>
        </p>
        <p className="text-sm text-muted-foreground">
          <Mail className="mr-1 inline size-3.5" />
          {row.email}
          {row.rut ? ` · RUT ${row.rut}` : ""}
          {courseName ? ` · Curso ${courseName}` : ""}
        </p>
        <p className="text-xs text-muted-foreground">
          {expired
            ? "El código venció. Cancela y crea la solicitud otra vez."
            : `El código vence a las ${expires.toLocaleTimeString("es-CL", {
                hour: "2-digit",
                minute: "2-digit",
              })}`}
        </p>
        {code && (
          <p className="text-sm">
            Código de confirmación: <span className="font-mono font-semibold">{code}</span>
          </p>
        )}
      </div>
      <div className="flex items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor={`code-${row.id}`} className="text-xs">
            Código recibido
          </Label>
          <Input
            id={`code-${row.id}`}
            inputMode="numeric"
            maxLength={6}
            className="w-32 font-mono"
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
          />
        </div>
        <Button disabled={busy || value.length < 6 || expired} onClick={() => onConfirm(value)}>
          <KeyRound className="size-4" />
          Confirmar
        </Button>
        <Button variant="ghost" disabled={busy} onClick={onCancel} aria-label="Cancelar solicitud">
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}
