import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import {
  AuthError,
  acceptInvite,
  getUser,
  login,
  recoverPassword,
  updateUser,
} from "@netlify/identity";

import { INVITE_TOKEN_KEY, RECOVERY_TOKEN_KEY } from "@/lib/role";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nueva contraseña · Gestión Escolar Paihuen" },
      {
        name: "description",
        content: "Define una nueva contraseña para tu cuenta del sistema de gestión escolar.",
      },
      { property: "og:title", content: "Nueva contraseña · Gestión Escolar Paihuen" },
      {
        property: "og:description",
        content: "Recupera el acceso definiendo una contraseña nueva.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResetPasswordPage,
});

function resetMessage(error: unknown) {
  if (error instanceof AuthError && (error.status === 401 || error.status === 404)) {
    return "El enlace expiró o ya fue usado. Solicita uno nuevo desde la pantalla de ingreso.";
  }
  return error instanceof Error ? error.message : undefined;
}

function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [recoveryToken, setRecoveryToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    const invite = sessionStorage.getItem(INVITE_TOKEN_KEY);
    const recovery = sessionStorage.getItem(RECOVERY_TOKEN_KEY);
    if (invite || recovery) {
      setInviteToken(invite);
      setRecoveryToken(recovery);
      setReady(true);
      setChecking(false);
      return;
    }
    // Sin enlace de correo: un usuario conectado también puede cambiar su clave aquí.
    getUser().then((user) => {
      if (user) setReady(true);
      setChecking(false);
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    setBusy(true);
    try {
      let email: string | undefined;
      if (inviteToken) {
        email = (await acceptInvite(inviteToken, password)).email;
        sessionStorage.removeItem(INVITE_TOKEN_KEY);
      } else if (recoveryToken) {
        email = (await recoverPassword(recoveryToken, password)).email;
        sessionStorage.removeItem(RECOVERY_TOKEN_KEY);
      } else {
        await updateUser({ password });
      }
      // Inicia sesión con la clave nueva para que el servidor reciba la cookie de sesión.
      if (email) await login(email, password);
    } catch (error) {
      setBusy(false);
      if (recoveryToken) {
        // El token es de un solo uso: si ya se canjeó, el usuario quedó conectado y el
        // siguiente intento cambia la clave con `updateUser`.
        sessionStorage.removeItem(RECOVERY_TOKEN_KEY);
        setRecoveryToken(null);
        setReady(Boolean(await getUser().catch(() => null)));
      }
      toast.error("No pudimos cambiar la contraseña", { description: resetMessage(error) });
      return;
    }
    toast.success("Contraseña actualizada");
    window.location.href = "/";
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="page-heading">Definir nueva contraseña</h1>
      {checking ? (
        <p className="mt-3 text-sm text-muted-foreground">Verificando el enlace…</p>
      ) : !ready ? (
        <div className="mt-3 space-y-4 text-sm text-muted-foreground">
          <p>Abre el enlace que recibiste por correo para poder definir tu nueva contraseña.</p>
          <Link to="/auth" className="inline-block font-medium text-primary underline">
            Volver a ingresar
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="surface-panel mt-6 space-y-4 p-6">
          <div className="space-y-2">
            <Label htmlFor="new-password">Nueva contraseña</Label>
            <Input
              id="new-password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Repetir contraseña</Label>
            <Input
              id="confirm-password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={busy} className="w-full">
            <KeyRound className="size-4" />
            {busy ? "Guardando…" : "Guardar contraseña"}
          </Button>
        </form>
      )}
    </div>
  );
}
