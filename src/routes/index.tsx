import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarCheck2, FileSpreadsheet, HeartPulse, Users } from "lucide-react";
import { backend } from "@/integrations/backend/client";
import { MONTHS, toIsoDate } from "@/lib/school";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProtectedDataBadge } from "@/components/HealthPanel";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gestión Escolar Paihuen — Matrícula, salud y asistencia" },
      {
        name: "description",
        content:
          "Panel escolar para matrícula y seguimiento de estudiantes, ficha de salud según Ley 21.719 y asistencia diaria con exportación a SIGE.",
      },
      { property: "og:title", content: "Gestión Escolar Paihuen" },
      {
        property: "og:description",
        content: "Matrícula, salud escolar y asistencia digital con exportación a SIGE.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const now = new Date();
  const monthStart = toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1));
  const monthEnd = toIsoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  const stats = useQuery({
    queryKey: ["dashboard", monthStart],
    queryFn: async () => {
      const [students, courses, att, nee] = await Promise.all([
        backend.from("students").select("id", { count: "exact", head: true }).eq("active", true),
        backend.from("courses").select("*").order("name"),
        backend
          .from("attendance")
          .select("status")
          .gte("attendance_date", monthStart)
          .lte("attendance_date", monthEnd),
        backend
          .from("students")
          .select("id", { count: "exact", head: true })
          .eq("nee_full_support", true),
      ]);
      const rows = att.data ?? [];
      const present = rows.filter((r) => r.status !== "ausente").length;
      return {
        students: students.count ?? 0,
        courses: courses.data ?? [],
        nee: nee.count ?? 0,
        records: rows.length,
        pct: rows.length ? Math.round((present / rows.length) * 1000) / 10 : 0,
      };
    },
  });

  const cards = [
    {
      to: "/estudiantes",
      icon: Users,
      title: "Matrícula y seguimiento",
      text: "Ficha completa del alumno y apoderado, test de fonoaudiología, entrevista e historial de movimientos.",
    },
    {
      to: "/estudiantes/salud",
      icon: HeartPulse,
      title: "Salud escolar",
      text: "Alergias, condiciones preexistentes, tipo de sangre y contactos de emergencia con acceso por perfil.",
    },
    {
      to: "/asistencia",
      icon: CalendarCheck2,
      title: "Asistencia diaria",
      text: "Registro por curso con presente, ausente o justificado y conteo automático.",
    },
    {
      to: "/sige",
      icon: FileSpreadsheet,
      title: "Revisión y exportación SIGE",
      text: "Revisión mensual con alertas de omisiones y descarga de la planilla Excel.",
    },
  ] as const;

  return (
    <div className="space-y-10">
      <section className="overflow-hidden rounded-2xl bg-primary-deep px-6 py-10 text-primary-foreground shadow-raised sm:px-10">
        <Badge className="bg-accent text-accent-foreground hover:bg-accent">
          Escuela infantil y parvularia
        </Badge>
        <h1 className="mt-4 max-w-3xl font-display text-4xl font-semibold leading-tight sm:text-5xl">
          Todo el libro de clases, en un solo lugar digital
        </h1>
        <p className="mt-4 max-w-2xl text-primary-foreground/80">
          Matrícula, historial del estudiante, ficha de salud y asistencia mensual lista para cargar
          en SIGE, sin traspasos manuales ni conteos a mano.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Estudiantes activos" value={stats.data?.students ?? "—"} />
        <Stat label="Cursos" value={stats.data?.courses.length ?? "—"} />
        <Stat
          label={`Asistencia ${MONTHS[now.getMonth()]}`}
          value={stats.data ? `${stats.data.pct}%` : "—"}
        />
        <Stat label="Con apoyo N.E.E. completo" value={stats.data?.nee ?? "—"} />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {cards.map(({ to, icon: Icon, title, text }) => (
          <Link key={to} to={to} className="group">
            <Card className="h-full transition-shadow group-hover:shadow-raised">
              <CardHeader>
                <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </span>
                <CardTitle className="mt-3 font-display text-xl">{title}</CardTitle>
                <CardDescription>{text}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </section>

      <section className="surface-panel p-6">
        <h2 className="font-display text-xl font-semibold">Cursos del establecimiento</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          {(stats.data?.courses ?? []).map((c) => (
            <li key={c.id} className="rounded-xl border border-border p-4">
              <p className="font-display text-lg font-semibold">{c.name}</p>
              <p className="text-sm text-muted-foreground">{c.level}</p>
              {c.teacher_name && <p className="mt-1 text-xs text-muted-foreground">{c.teacher_name}</p>}
            </li>
          ))}
        </ul>
        <div className="mt-6">
          <ProtectedDataBadge />
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="mt-2 font-display text-3xl font-semibold text-primary-deep">{value}</p>
      </CardContent>
    </Card>
  );
}
