import { createFileRoute } from "@tanstack/react-router";
import { StudentRegistryView } from "@/components/StudentRegistryView";

export const Route = createFileRoute("/estudiantes/datos")({
  head: () => ({ meta: [
    { title: "Ficha Estudiantil — Escuela Paihuen" },
    { name: "description", content: "Consulta de la ficha estudiantil: datos personales básicos por nivel y curso." },
    { property: "og:title", content: "Ficha Estudiantil — Escuela Paihuen" },
    { property: "og:description", content: "Información personal básica y ubicación académica de estudiantes." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => <StudentRegistryView kind="datos" />,
});
