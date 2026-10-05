import { createFileRoute } from "@tanstack/react-router";
import { StudentRegistryView } from "@/components/StudentRegistryView";

export const Route = createFileRoute("/estudiantes/movimientos")({
  head: () => ({ meta: [
    { title: "Traslados — Escuela Paihuen" },
    { name: "description", content: "Historial de traslados, retiros y cambios de estudiantes." },
    { property: "og:title", content: "Traslados — Escuela Paihuen" },
    { property: "og:description", content: "Consulta de traslados, bajas y cambios registrados." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => <StudentRegistryView kind="movimientos" />,
});
