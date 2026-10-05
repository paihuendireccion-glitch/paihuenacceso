import { getColumns, getTableName, is, Table } from "drizzle-orm";

import * as schema from "../../db/schema";
import { HttpError, pool, type Account } from "./account";

/**
 * Ejecutor genérico de consultas usado por el cliente de datos del navegador
 * (`src/integrations/backend/client.ts`). Recibe una especificación serializada
 * (tabla, columnas, filtros, orden, valores), valida tablas y columnas contra el
 * esquema de Drizzle y aplica las reglas de acceso por rol antes de ejecutar SQL
 * parametrizado. Reemplaza las políticas RLS que tenía el proyecto original.
 */

export type FilterOp = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "is" | "ilike";
export type QuerySpec = {
  table: string;
  action: "select" | "insert" | "update" | "upsert" | "delete";
  columns?: string;
  filters?: { col: string; op: FilterOp; value: unknown }[];
  order?: { col: string; ascending: boolean }[];
  limit?: number;
  single?: "single" | "maybe";
  count?: boolean;
  head?: boolean;
  values?: Record<string, unknown> | Record<string, unknown>[];
  onConflict?: string;
  returning?: string;
};

type Row = Record<string, unknown>;

const TABLES = new Map<string, Set<string>>();
for (const value of Object.values(schema)) {
  if (is(value, Table)) {
    TABLES.set(getTableName(value), new Set(Object.keys(getColumns(value))));
  }
}

// Relaciones "muchos a uno" que el cliente puede incrustar, p. ej. `students → courses(name)`.
const EMBEDS: Record<string, Record<string, { table: string; fk: string }>> = {
  students: { courses: { table: "courses", fk: "course_id" } },
  attendance: { students: { table: "students", fk: "student_id" }, courses: { table: "courses", fk: "course_id" } },
};

// Tablas cuyos registros pertenecen a un estudiante (columna `student_id`).
const STUDENT_LINKED = new Set([
  "guardians",
  "substitute_guardians",
  "student_movements",
  "health_records",
  "health_allergies",
  "health_conditions",
  "emergency_contacts",
  "attendance",
]);

const q = (ident: string) => `"${ident.replace(/"/g, '""')}"`;

class Params {
  values: unknown[] = [];
  add(value: unknown) {
    this.values.push(value);
    return `$${this.values.length}`;
  }
}

function columnsOf(table: string) {
  const cols = TABLES.get(table);
  if (!cols) throw new HttpError(400, `Tabla desconocida: ${table}`);
  return cols;
}

function assertColumn(table: string, col: string) {
  if (!columnsOf(table).has(col)) throw new HttpError(400, `Columna desconocida: ${table}.${col}`);
}

// ---------------------------------------------------------------------------
// Reglas de acceso

function guardianStudentsSql(account: Account, params: Params) {
  const email = params.add(account.profile.email ?? account.user.email ?? "");
  return `(SELECT g.student_id FROM guardians g WHERE lower(g.email) = lower(${email}))`;
}

/** Condición SQL que limita las filas visibles, `null` si no hay restricción. */
function readScope(table: string, account: Account, params: Params): string | null {
  const { role } = account;
  if (!role) throw new HttpError(403, "Tu cuenta aún no tiene un rol asignado.");
  if (role === "encargado") return null;

  if (table === "pending_users") return "false";
  if (table === "profiles") return `base.id = ${params.add(account.user.id)}`;
  if (table === "user_roles") return `base.user_id = ${params.add(account.user.id)}`;

  // Educadora: lectura de todos los cursos y estudiantes.
  if (role === "educadora") return null;

  // Apoderado: solo los estudiantes donde figura como apoderado.
  const own = guardianStudentsSql(account, params);
  if (table === "students") return `base.id IN ${own}`;
  if (table === "courses") return `base.id IN (SELECT s.course_id FROM students s WHERE s.id IN ${own})`;
  if (STUDENT_LINKED.has(table)) return `base.student_id IN ${own}`;
  return "false";
}

function teacherStudentsSql(account: Account, params: Params) {
  const me = params.add(account.user.id);
  return `(SELECT s.id FROM students s JOIN courses c ON c.id = s.course_id WHERE c.teacher_profile_id = ${me})`;
}

/** Condición SQL que limita las filas que se pueden modificar. Lanza si no hay permiso. */
function writeScope(table: string, account: Account, params: Params): string | null {
  if (table === "pending_users") {
    throw new HttpError(403, "Las solicitudes de usuario se gestionan desde Administración.");
  }
  if (account.role === "encargado") return null;
  if (account.role === "educadora" && table === "attendance") {
    return `base.student_id IN ${teacherStudentsSql(account, params)}`;
  }
  throw new HttpError(403, "No tienes permisos para modificar estos datos.");
}

async function assertCanInsert(table: string, rows: Row[], account: Account) {
  // writeScope valida el permiso; la condición se arma aparte con sus propios parámetros.
  if (!writeScope(table, account, new Params())) return;
  const params = new Params();
  // Educadora: todos los estudiantes deben pertenecer a sus cursos.
  const ids = [...new Set(rows.map((r) => String(r.student_id ?? "")))];
  const idsParam = params.add(ids);
  const res = await pool().query(
    `SELECT count(*)::int AS n FROM students base0 WHERE base0.id::text = ANY(${idsParam}::text[])
       AND base0.id IN ${teacherStudentsSql(account, params)}`,
    params.values,
  );
  if (res.rows[0].n !== ids.length) {
    throw new HttpError(403, "Solo puedes registrar asistencia de tus cursos.");
  }
}

// ---------------------------------------------------------------------------
// Construcción de SQL

type Projection = { columns: string[] | "*"; embeds: { name: string; columns: string[] | "*" }[] };

function parseColumns(table: string, select: string | undefined): Projection {
  const raw = (select ?? "*").trim() || "*";
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of raw) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else current += ch;
  }
  if (current.trim()) parts.push(current.trim());

  const projection: Projection = { columns: [], embeds: [] };
  const cols: string[] = [];
  let star = false;
  for (const part of parts) {
    const embed = part.match(/^(\w+)\s*\(([^)]*)\)$/);
    if (embed) {
      const [, name, inner] = embed;
      const rel = EMBEDS[table]?.[name];
      if (!rel) throw new HttpError(400, `Relación desconocida: ${table}.${name}`);
      const innerCols = inner.split(",").map((c) => c.trim()).filter(Boolean);
      if (innerCols.includes("*") || innerCols.length === 0) {
        projection.embeds.push({ name, columns: "*" });
      } else {
        innerCols.forEach((c) => assertColumn(rel.table, c));
        projection.embeds.push({ name, columns: innerCols });
      }
    } else if (part === "*") {
      star = true;
    } else {
      assertColumn(table, part);
      cols.push(part);
    }
  }
  projection.columns = star ? "*" : cols;
  return projection;
}

function jsonObject(alias: string, columns: string[]) {
  return `jsonb_build_object(${columns.map((c) => `'${c}', ${alias}.${q(c)}`).join(", ")})`;
}

function projectionSql(table: string, projection: Projection) {
  let expr =
    projection.columns === "*"
      ? "to_jsonb(base)"
      : projection.columns.length
        ? jsonObject("base", projection.columns)
        : "'{}'::jsonb";
  for (const embed of projection.embeds) {
    const rel = EMBEDS[table][embed.name];
    const inner = embed.columns === "*" ? "to_jsonb(e)" : jsonObject("e", embed.columns);
    expr += ` || jsonb_build_object('${embed.name}', (SELECT ${inner} FROM ${q(rel.table)} e WHERE e.id = base.${q(rel.fk)}))`;
  }
  return expr;
}

function whereSql(spec: QuerySpec, params: Params, scope: string | null) {
  const clauses: string[] = [];
  for (const f of spec.filters ?? []) {
    assertColumn(spec.table, f.col);
    const col = `base.${q(f.col)}`;
    switch (f.op) {
      case "eq":
        clauses.push(f.value === null ? `${col} IS NULL` : `${col} = ${params.add(f.value)}`);
        break;
      case "neq":
        clauses.push(f.value === null ? `${col} IS NOT NULL` : `${col} <> ${params.add(f.value)}`);
        break;
      case "gt":
        clauses.push(`${col} > ${params.add(f.value)}`);
        break;
      case "gte":
        clauses.push(`${col} >= ${params.add(f.value)}`);
        break;
      case "lt":
        clauses.push(`${col} < ${params.add(f.value)}`);
        break;
      case "lte":
        clauses.push(`${col} <= ${params.add(f.value)}`);
        break;
      case "in": {
        const list = Array.isArray(f.value) ? f.value.map(String) : [];
        clauses.push(`${col}::text = ANY(${params.add(list)}::text[])`);
        break;
      }
      case "is":
        if (f.value === null) clauses.push(`${col} IS NULL`);
        else if (f.value === true) clauses.push(`${col} IS TRUE`);
        else if (f.value === false) clauses.push(`${col} IS FALSE`);
        else throw new HttpError(400, "Valor no válido para is()");
        break;
      case "ilike":
        clauses.push(`${col}::text ILIKE ${params.add(f.value)}`);
        break;
      default:
        throw new HttpError(400, `Operador no soportado: ${String(f.op)}`);
    }
  }
  if (scope) clauses.push(`(${scope})`);
  return clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
}

function orderSql(spec: QuerySpec) {
  if (!spec.order?.length) return "";
  return `ORDER BY ${spec.order
    .map((o) => {
      assertColumn(spec.table, o.col);
      return `base.${q(o.col)} ${o.ascending ? "ASC" : "DESC"} NULLS ${o.ascending ? "LAST" : "FIRST"}`;
    })
    .join(", ")}`;
}

function pick(rows: Row[], select: string | undefined) {
  if (!select || select.trim() === "*") return rows;
  const keys = select.split(",").map((k) => k.trim());
  return rows.map((r) => Object.fromEntries(keys.map((k) => [k, r[k]])));
}

function finish(rows: Row[], spec: QuerySpec) {
  if (spec.single) {
    if (rows.length > 1) throw new HttpError(406, "Se esperaba un solo registro y hubo varios.");
    if (rows.length === 0) {
      if (spec.single === "maybe") return { data: null };
      throw new HttpError(406, "No se encontró el registro solicitado.");
    }
    return { data: rows[0] };
  }
  return { data: rows };
}

// ---------------------------------------------------------------------------

export async function runQuery(spec: QuerySpec, account: Account) {
  const table = spec.table;
  columnsOf(table);
  const db = pool();

  if (spec.action === "select") {
    const params = new Params();
    const scope = readScope(table, account, params);
    if (spec.count && spec.head) {
      const where = whereSql(spec, params, scope);
      const res = await db.query(`SELECT count(*)::int AS n FROM ${q(table)} base ${where}`, params.values);
      return { data: null, count: res.rows[0].n as number };
    }
    const projection = parseColumns(table, spec.columns);
    const where = whereSql(spec, params, scope);
    const limit = spec.limit ? `LIMIT ${Math.max(0, Math.floor(spec.limit))}` : "";
    const res = await db.query(
      `SELECT ${projectionSql(table, projection)} AS r FROM ${q(table)} base ${where} ${orderSql(spec)} ${limit}`,
      params.values,
    );
    const rows = res.rows.map((r: { r: Row }) => r.r);
    return { ...finish(rows, spec), count: spec.count ? rows.length : null };
  }

  if (spec.action === "insert" || spec.action === "upsert") {
    const rows = (Array.isArray(spec.values) ? spec.values : [spec.values ?? {}]) as Row[];
    if (!rows.length) return { data: [] };
    await assertCanInsert(table, rows, account);

    const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    keys.forEach((k) => assertColumn(table, k));
    const params = new Params();
    const valuesSql = rows
      .map((r) => `(${keys.map((k) => (k in r ? params.add(r[k]) : "DEFAULT")).join(", ")})`)
      .join(", ");

    let conflict = "";
    if (spec.action === "upsert") {
      const target = (spec.onConflict ?? "id").split(",").map((c) => c.trim());
      target.forEach((c) => assertColumn(table, c));
      const updates = keys.filter((k) => !target.includes(k));
      conflict = updates.length
        ? `ON CONFLICT (${target.map(q).join(", ")}) DO UPDATE SET ${updates
            .map((k) => `${q(k)} = EXCLUDED.${q(k)}`)
            .join(", ")}`
        : `ON CONFLICT (${target.map(q).join(", ")}) DO NOTHING`;
    }

    const res = await db.query(
      `INSERT INTO ${q(table)} AS base (${keys.map(q).join(", ")}) VALUES ${valuesSql} ${conflict} RETURNING to_jsonb(base) AS r`,
      params.values,
    );
    const out = pick(res.rows.map((r: { r: Row }) => r.r), spec.returning);
    return finish(out, spec);
  }

  if (spec.action === "update" || spec.action === "delete") {
    if (!spec.filters?.length) throw new HttpError(400, "Se requiere al menos un filtro.");
    const params = new Params();
    const scope = writeScope(table, account, params);

    let sqlText: string;
    if (spec.action === "update") {
      const values = (spec.values ?? {}) as Row;
      const keys = Object.keys(values);
      if (!keys.length) throw new HttpError(400, "No hay campos para actualizar.");
      keys.forEach((k) => assertColumn(table, k));
      const set = keys.map((k) => `${q(k)} = ${params.add(values[k])}`);
      if (columnsOf(table).has("updated_at") && !keys.includes("updated_at")) set.push(`"updated_at" = now()`);
      sqlText = `UPDATE ${q(table)} AS base SET ${set.join(", ")} ${whereSql(spec, params, scope)} RETURNING to_jsonb(base) AS r`;
    } else {
      sqlText = `DELETE FROM ${q(table)} AS base ${whereSql(spec, params, scope)} RETURNING to_jsonb(base) AS r`;
    }
    const res = await db.query(sqlText, params.values);
    const rows = res.rows.map((r: { r: Row }) => r.r);
    if (spec.returning === undefined && !spec.single) return { data: null };
    return finish(pick(rows, spec.returning), spec);
  }

  throw new HttpError(400, "Acción no soportada.");
}
