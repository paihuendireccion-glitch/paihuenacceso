import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/salud")({
  beforeLoad: () => {
    throw redirect({ to: "/estudiantes/salud", replace: true });
  },
  head: () => ({ meta: [
    { title: "Salud escolar — Escuela Paihuen" },
    { name: "description", content: "Acceso a la ficha de salud escolar de estudiantes." },
    { property: "og:title", content: "Salud escolar — Escuela Paihuen" },
    { property: "og:description", content: "Ficha de salud escolar protegida por perfil." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
});
