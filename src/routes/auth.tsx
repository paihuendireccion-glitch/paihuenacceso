import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LogIn, ShieldCheck, UserPlus } from "lucide-react";
import { AuthError, login, requestPasswordRecovery } from "@netlify/identity";

import { createFirstAdmin, getSetupStatus } from "@/lib/account.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Ingresar · Gestión Escolar Paihuen" },
      {
        name: "description",
        content:
          "Ingresa con tu correo institucional para administrar matrículas, salud escolar y asistencia.",
      },
      { property: "og:title", content: "Ingresar · Gestión Escolar Paihuen" },
      {
        property: "og:description",
        content: "Acceso para educadoras, jefaturas UTP y apoderados de la Escuela Paihuen.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function authMessage(error: unknown) {
  if (error instanceof AuthError) {
    if (error.status === 401 || error.status === 400) return "Correo o contraseña incorrectos.";
    return error.message;
  }
  return error instanceof Error ? error.message : "Error inesperado";
}

function AuthPage() {
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [recovering, setRecovering] = useState(false);
  const [needsAdmin, setNeedsAdmin] = useState(false);

  useEffect(() => {
    getSetupStatus()
      .then((s) => setNeedsAdmin(s.needsAdmin))
      .catch(() => setNeedsAdmin(false));
  }, []);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await login(email, password);
    } catch (error) {
      setBusy(false);
      toast.error("No pudimos ingresar", { description: authMessage(error) });
      return;
    }
    toast.success("Bienvenido");
    // Recarga completa para que el servidor reciba la cookie de sesión.
    window.location.href = "/";
  }

  async function sendRecovery() {
    if (!email) {
      toast.error("Escribe tu correo para enviarte el enlace");
      return;
    }
    setBusy(true);
    try {
      await requestPasswordRecovery(email);
    } catch (error) {
      setBusy(false);
      toast.error("No pudimos enviar el enlace", { description: authMessage(error) });
      return;
    }
    setBusy(false);
    setRecovering(true);
    toast.success("Enlace enviado", { description: "Revisa tu correo para definir la nueva clave." });
  }

  if (needsAdmin) return <FirstAdminSetup />;

  return (
    <div className="mx-auto max-w-md">
      <h1 className="page-heading">Acceso al sistema</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Las cuentas las crea el Administrador del establecimiento. Ingresa con el correo y la
        contraseña que recibiste.
      </p>

      <form onSubmit={signIn} className="surface-panel mt-6 space-y-4 p-6">
        <div className="space-y-2">
          <Label htmlFor="email">Correo electrónico</Label>
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={busy} className="w-full">
          <LogIn className="size-4" />
          {busy ? "Ingresando…" : "Ingresar"}
        </Button>
        <button
          type="button"
          onClick={sendRecovery}
          disabled={busy}
          className="w-full text-center text-xs text-muted-foreground underline"
        >
          ¿Olvidaste tu contraseña?
        </button>
        {recovering && (
          <p className="text-center text-xs text-muted-foreground">
            Te enviamos un enlace a <span className="font-medium">{email}</span>.
          </p>
        )}
      </form>

      <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
        <ShieldCheck className="size-3.5" />
        ¿Necesitas una cuenta? Pídela al Administrador del establecimiento.
      </p>
    </div>
  );
}

function FirstAdminSetup() {
  const [busy, setBusy] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await createFirstAdmin({ data: { fullName, email, password } });
      await login(email, password);
    } catch (error) {
      setBusy(false);
      toast.error("No pudimos crear la cuenta", { description: authMessage(error) });
      return;
    }
    toast.success("Cuenta de Administrador creada");
    window.location.href = "/admin";
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="page-heading">Configuración inicial</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        El sistema todavía no tiene un Administrador. Crea la cuenta del Encargado del
        establecimiento; desde ella podrás dar de alta a educadoras y apoderados.
      </p>

      <form onSubmit={submit} className="surface-panel mt-6 space-y-4 p-6">
        <div className="space-y-2">
          <Label htmlFor="admin-name">Nombre completo</Label>
          <Input
            id="admin-name"
            required
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="admin-email">Correo electrónico</Label>
          <Input
            id="admin-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="admin-password">Contraseña</Label>
          <Input
            id="admin-password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={busy} className="w-full">
          <UserPlus className="size-4" />
          {busy ? "Creando…" : "Crear Administrador"}
        </Button>
      </form>

      <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
        <ShieldCheck className="size-3.5" />
        Este paso solo está disponible una vez.
      </p>
    </div>
  );
}
