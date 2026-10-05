import { createFileRoute } from "@tanstack/react-router";
import { StudentRegistryView } from "@/components/StudentRegistryView";

export const Route = createFileRoute("/estudiantes/procesos")({
  head: () => ({ meta: [
    { title: "Test Fonoaudiología y Entrevista Apoderado — Escuela Paihuen" },
    { name: "description", content: "Test de fonoaudiología y entrevistas a apoderados del proceso de matrícula." },
    { property: "og:title", content: "Test Fonoaudiología y Entrevista Apoderado — Escuela Paihuen" },
    { property: "og:description", content: "Test fonoaudiológico y entrevistas a apoderados de estudiantes." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => <StudentRegistryView kind="matricula" />,
});
