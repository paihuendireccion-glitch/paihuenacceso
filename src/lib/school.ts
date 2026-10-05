export const LEVELS = ["Medio Mayor", "NT1", "NT2"] as const;

export const MOVEMENT_TYPES = [
  "Cambio de jornada",
  "Cambio Escuela Paihuen - Paihuen Mapu",
  "Cambio Paihuen Mapu - Paihuen",
  "Traslado a otro establecimiento",
  "Retiro",
] as const;

export const ATTENDANCE_STATUS = ["presente", "ausente", "justificado"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUS)[number];

export const STATUS_LABEL: Record<AttendanceStatus, string> = {
  presente: "Presente",
  ausente: "Ausente",
  justificado: "Justificado",
};

export const ROLES = ["encargado", "educadora", "apoderado"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  encargado: "Encargado / Administrador",
  educadora: "Educadora",
  apoderado: "Apoderado",
};

export const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export type Student = {
  id: string;
  course_id: string | null;
  list_number: number | null;
  enrollment_number: string | null;
  level: string;
  apellido_paterno: string;
  apellido_materno: string | null;
  nombres: string;
  run_ipe: string | null;
  birth_date: string | null;
  sex: string | null;
  nee_full_support: boolean;
  address: string | null;
  comuna: string | null;
  speech_test_url: string | null;
  speech_test_name: string | null;
  guardian_interview: string | null;
  active: boolean;
};

export type Course = {
  id: string;
  name: string;
  level: string;
  teacher_name: string | null;
};

export function fullName(s: {
  apellido_paterno: string;
  apellido_materno?: string | null;
  nombres: string;
}) {
  return `${s.apellido_paterno} ${s.apellido_materno ?? ""} ${s.nombres}`.replace(/\s+/g, " ").trim();
}

export function toIsoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/** Weekdays (Mon-Fri) of a given month, as ISO date strings. */
export function schoolDays(year: number, month: number) {
  const days: string[] = [];
  const date = new Date(year, month - 1, 1);
  while (date.getMonth() === month - 1) {
    const dow = date.getDay();
    if (dow !== 0 && dow !== 6) days.push(toIsoDate(date));
    date.setDate(date.getDate() + 1);
  }
  return days;
}

export function formatDateLong(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} de ${MONTHS[(m ?? 1) - 1]} de ${y}`;
}
