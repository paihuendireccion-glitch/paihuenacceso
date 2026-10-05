import { getUser, type User } from "@netlify/identity";
import { getDatabase } from "@netlify/database";

import type { Role } from "@/lib/school";

export type Account = {
  user: User;
  profile: { id: string; full_name: string | null; email: string | null; rut: string | null };
  /** `null` = cuenta sin rol asignado (sin acceso a datos). */
  role: Role | null;
};

const PRIORITY: Role[] = ["encargado", "educadora", "apoderado"];

export function pool() {
  return getDatabase().pool;
}

/**
 * Resuelve el usuario de Netlify Identity de la petición actual junto a su perfil y rol.
 * Crea el perfil la primera vez que el usuario se conecta. El rol se guarda en la base de
 * datos (tabla `user_roles`) y solo lo asigna un Administrador.
 */
export async function getAccount(): Promise<Account | null> {
  const user = await getUser();
  if (!user) return null;

  const db = pool();
  const email = user.email?.toLowerCase() ?? null;

  await db.query(
    `INSERT INTO profiles (id, full_name, email) VALUES ($1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET email = COALESCE(EXCLUDED.email, profiles.email)`,
    [user.id, user.name ?? "", email],
  );

  const [profileRes, rolesRes] = await Promise.all([
    db.query(`SELECT id, full_name, email, rut FROM profiles WHERE id = $1`, [user.id]),
    db.query(`SELECT role FROM user_roles WHERE user_id = $1`, [user.id]),
  ]);

  const roles = rolesRes.rows.map((r: { role: string }) => r.role);
  const role = PRIORITY.find((r) => roles.includes(r)) ?? null;

  return { user, profile: profileRes.rows[0], role };
}

export async function requireAccount(): Promise<Account> {
  const account = await getAccount();
  if (!account) throw new HttpError(401, "Debes iniciar sesión.");
  return account;
}

export async function requireAdmin(): Promise<Account> {
  const account = await requireAccount();
  if (account.role !== "encargado") {
    throw new HttpError(403, "Solo un Administrador puede realizar esta acción.");
  }
  return account;
}

export async function hasAnyAdmin() {
  const res = await pool().query(`SELECT 1 FROM user_roles WHERE role = 'encargado' LIMIT 1`);
  return res.rows.length > 0;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
