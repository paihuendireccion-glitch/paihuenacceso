import { createServerFn } from "@tanstack/react-start";

/** Perfil y rol del usuario conectado (crea el perfil la primera vez). */
export const getMyAccount = createServerFn({ method: "GET" }).handler(async () => {
  const { getAccount } = await import("@/backend/account");
  const account = await getAccount();
  if (!account) return null;
  return { profile: account.profile, role: account.role };
});

/** Indica si el establecimiento aún no tiene un Administrador (primer ingreso). */
export const getSetupStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { hasAnyAdmin } = await import("@/backend/account");
  return { needsAdmin: !(await hasAnyAdmin()) };
});

/**
 * Crea la primera cuenta de Administrador. Solo funciona mientras no exista
 * ningún Administrador; después, las cuentas se crean desde Administración.
 */
export const createFirstAdmin = createServerFn({ method: "POST" })
  .inputValidator((input: { fullName: string; email: string; password: string }) => {
    const email = input.email.trim().toLowerCase();
    if (!input.fullName.trim()) throw new Error("El nombre es obligatorio.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("El correo no es válido.");
    if (input.password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres.");
    return { fullName: input.fullName.trim(), email, password: input.password };
  })
  .handler(async ({ data }) => {
    const { hasAnyAdmin, pool } = await import("@/backend/account");
    const { admin } = await import("@netlify/identity");
    if (await hasAnyAdmin()) throw new Error("El sistema ya tiene un Administrador.");

    const user = await admin.createUser({
      email: data.email,
      password: data.password,
      data: { user_metadata: { full_name: data.fullName } },
    });
    const db = pool();
    await db.query(
      `INSERT INTO profiles (id, full_name, email) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email`,
      [user.id, data.fullName, data.email],
    );
    await db.query(
      `INSERT INTO user_roles (user_id, role) VALUES ($1, 'encargado') ON CONFLICT DO NOTHING`,
      [user.id],
    );
    return { ok: true };
  });
