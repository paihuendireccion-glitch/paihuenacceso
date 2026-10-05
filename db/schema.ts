import {
  boolean,
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const appRole = pgEnum("app_role", ["encargado", "educadora", "apoderado"]);

// Perfiles de usuario. `id` es el id del usuario en Netlify Identity.
export const profiles = pgTable("profiles", {
  id: text().primaryKey(),
  full_name: text(),
  email: text(),
  rut: text(),
  created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const userRoles = pgTable(
  "user_roles",
  {
    id: uuid().primaryKey().defaultRandom(),
    user_id: text()
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    role: appRole().notNull(),
    created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.user_id, t.role)],
);

export const courses = pgTable("courses", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  level: text().notNull(),
  teacher_name: text(),
  teacher_profile_id: text().references(() => profiles.id, { onDelete: "set null" }),
  is_sample: boolean().notNull().default(false),
  created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const students = pgTable(
  "students",
  {
    id: uuid().primaryKey().defaultRandom(),
    course_id: uuid().references(() => courses.id, { onDelete: "set null" }),
    list_number: integer(),
    enrollment_number: text(),
    level: text().notNull().default("NT1"),
    apellido_paterno: text().notNull(),
    apellido_materno: text(),
    nombres: text().notNull(),
    run_ipe: text(),
    birth_date: date(),
    sex: text(),
    nee_full_support: boolean().notNull().default(false),
    address: text(),
    comuna: text(),
    speech_test_url: text(),
    speech_test_name: text(),
    guardian_interview: text(),
    parents_marital_status: text(),
    lives_with: text(),
    children_count: integer(),
    sibling_position: text(),
    active: boolean().notNull().default(true),
    is_sample: boolean().notNull().default(false),
    created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_students_course").on(t.course_id),
    check(
      "students_children_count_nonneg",
      sql`${t.children_count} IS NULL OR ${t.children_count} >= 0`,
    ),
  ],
);

export const guardians = pgTable("guardians", {
  id: uuid().primaryKey().defaultRandom(),
  student_id: uuid()
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  list_number: integer(),
  apellido_paterno: text(),
  apellido_materno: text(),
  nombres: text(),
  relationship: text(),
  address: text(),
  comuna: text(),
  phone: text(),
  email: text(),
  observations: text(),
  created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const substituteGuardians = pgTable("substitute_guardians", {
  id: uuid().primaryKey().defaultRandom(),
  student_id: uuid()
    .notNull()
    .unique()
    .references(() => students.id, { onDelete: "cascade" }),
  full_name: text().notNull(),
  rut: text().notNull(),
  relationship: text().notNull(),
  phone: text().notNull(),
  email: text(),
  address: text(),
  created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const studentMovements = pgTable("student_movements", {
  id: uuid().primaryKey().defaultRandom(),
  student_id: uuid()
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  movement_date: date().notNull().defaultNow(),
  movement_type: text().notNull(),
  reason: text(),
  observations: text(),
  responsible: text(),
  created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const healthRecords = pgTable("health_records", {
  id: uuid().primaryKey().defaultRandom(),
  student_id: uuid()
    .notNull()
    .unique()
    .references(() => students.id, { onDelete: "cascade" }),
  blood_type: text(),
  notes: text(),
  updated_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const healthAllergies = pgTable("health_allergies", {
  id: uuid().primaryKey().defaultRandom(),
  student_id: uuid()
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  name: text().notNull(),
  severity: text(),
  created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const healthConditions = pgTable("health_conditions", {
  id: uuid().primaryKey().defaultRandom(),
  student_id: uuid()
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  name: text().notNull(),
  notes: text(),
  created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const emergencyContacts = pgTable("emergency_contacts", {
  id: uuid().primaryKey().defaultRandom(),
  student_id: uuid()
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  name: text().notNull(),
  relationship: text(),
  phone: text(),
  created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const attendance = pgTable(
  "attendance",
  {
    id: uuid().primaryKey().defaultRandom(),
    student_id: uuid()
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    course_id: uuid().references(() => courses.id, { onDelete: "set null" }),
    attendance_date: date().notNull(),
    status: text().notNull().default("presente"),
    note: text(),
    created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique().on(t.student_id, t.attendance_date),
    index("idx_attendance_date").on(t.attendance_date),
    index("idx_attendance_course").on(t.course_id),
  ],
);

// Solicitudes de alta de usuarios creadas por un Administrador (código de un solo uso).
export const pendingUsers = pgTable("pending_users", {
  id: uuid().primaryKey().defaultRandom(),
  full_name: text().notNull(),
  rut: text(),
  email: text().notNull(),
  role: appRole().notNull(),
  course_id: uuid().references(() => courses.id, { onDelete: "set null" }),
  code_hash: text().notNull(),
  expires_at: timestamp({ withTimezone: true }).notNull(),
  status: text().notNull().default("pendiente"),
  attempts: integer().notNull().default(0),
  created_by: text().notNull(),
  created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  confirmed_at: timestamp({ withTimezone: true }),
});
