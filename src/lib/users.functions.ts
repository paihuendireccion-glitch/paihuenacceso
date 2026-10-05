import { createServerFn } from "@tanstack/react-start";

type Role = "encargado" | "educadora" | "apoderado";

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomDigits(length: number) {
  const values = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(values, (v) => String(v % 10)).join("");
}

function tempPassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  const base = Array.from(bytes, (b) => b.toString(36)).join("");
  return `Ph${base.slice(0, 10)}!${randomDigits(2)}`;
}

async function server() {
  const mod = await import("@/backend/account");
  return { ...mod, db: mod.pool() };
}

export const requestUserInvite = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      fullName: string;
      rut: string;
      email: string;
      role: Role;
      courseId: string | null;
    }) => {
      const email = input.email.trim().toLowerCase();
      if (!input.fullName.trim()) throw new Error("El nombre es obligatorio.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("El correo no es válido.");
      if (!["encargado", "educadora", "apoderado"].includes(input.role)) {
        throw new Error("Rol no válido.");
      }
      return {
        fullName: input.fullName.trim(),
        rut: input.rut.trim(),
        email,
        role: input.role,
        courseId: input.courseId,
      };
    },
  )
  .handler(async ({ data }) => {
    const { requireAdmin, db } = await server();
    const account = await requireAdmin();

    const existing = await db.query(`SELECT id FROM profiles WHERE lower(email) = $1 LIMIT 1`, [
      data.email,
    ]);
    if (existing.rows.length) throw new Error("Ya existe una cuenta con ese correo.");

    await db.query(
      `UPDATE pending_users SET status = 'cancelado' WHERE email = $1 AND status = 'pendiente'`,
      [data.email],
    );

    const code = randomDigits(6);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const inserted = await db.query(
      `INSERT INTO pending_users (full_name, rut, email, role, course_id, code_hash, expires_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [
        data.fullName,
        data.rut || null,
        data.email,
        data.role,
        data.courseId,
        await sha256(code),
        expiresAt,
        account.user.id,
      ],
    );

    // Envío por correo al Administrador: se activa cuando el correo del proyecto
    // esté configurado. Mientras tanto el código se entrega en pantalla.
    const adminEmail = account.user.email ?? null;

    return { id: inserted.rows[0].id as string, code, adminEmail, emailSent: false };
  });

export const confirmUserInvite = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string; code: string }) => ({
    id: input.id,
    code: input.code.trim(),
  }))
  .handler(async ({ data }) => {
    const { requireAdmin, db } = await server();
    const { admin } = await import("@netlify/identity");
    await requireAdmin();

    const pending = await db.query(`SELECT * FROM pending_users WHERE id = $1`, [data.id]);
    const row = pending.rows[0];
    if (!row) throw new Error("No encontramos la solicitud.");
    if (row.status !== "pendiente") throw new Error("Esta solicitud ya no está pendiente.");
    if (new Date(row.expires_at).getTime() < Date.now()) {
      await db.query(`UPDATE pending_users SET status = 'vencido' WHERE id = $1`, [row.id]);
      throw new Error("El código venció. Crea la solicitud otra vez.");
    }
    if ((row.attempts ?? 0) >= 5) throw new Error("Demasiados intentos. Crea la solicitud otra vez.");

    if ((await sha256(data.code)) !== row.code_hash) {
      await db.query(`UPDATE pending_users SET attempts = attempts + 1 WHERE id = $1`, [row.id]);
      throw new Error("El código no coincide.");
    }

    const password = tempPassword();
    let newUserId: string;
    try {
      const created = await admin.createUser({
        email: row.email,
        password,
        data: { user_metadata: { full_name: row.full_name } },
      });
      newUserId = created.id;
    } catch (error) {
      throw new Error(
        error instanceof Error ? `No se pudo crear la cuenta: ${error.message}` : "No se pudo crear la cuenta.",
      );
    }

    await db.query(
      `INSERT INTO profiles (id, full_name, email, rut) VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, rut = EXCLUDED.rut`,
      [newUserId, row.full_name, row.email, row.rut],
    );
    await db.query(`DELETE FROM user_roles WHERE user_id = $1`, [newUserId]);
    await db.query(`INSERT INTO user_roles (user_id, role) VALUES ($1, $2)`, [newUserId, row.role]);

    if (row.course_id && row.role === "educadora") {
      await db.query(`UPDATE courses SET teacher_profile_id = $1, teacher_name = $2 WHERE id = $3`, [
        newUserId,
        row.full_name,
        row.course_id,
      ]);
    }

    await db.query(
      `UPDATE pending_users SET status = 'confirmado', confirmed_at = now() WHERE id = $1`,
      [row.id],
    );

    // Correo de credenciales al nuevo usuario: se activa con el correo configurado.
    return { email: row.email as string, password, emailSent: false };
  });

export const cancelUserInvite = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const { requireAdmin, db } = await server();
    await requireAdmin();
    await db.query(`UPDATE pending_users SET status = 'cancelado' WHERE id = $1`, [data.id]);
    return { ok: true };
  });
