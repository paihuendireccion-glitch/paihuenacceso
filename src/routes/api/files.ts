import { createFileRoute } from "@tanstack/react-router";
import { getStore } from "@netlify/blobs";

import { HttpError, pool, requireAccount, requireAdmin } from "@/backend/account";
import { handle } from "@/backend/http";

const BUCKETS = new Set(["documentos-matricula"]);

const MIME: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

function bucketStore(bucket: string | null) {
  if (!bucket || !BUCKETS.has(bucket)) throw new HttpError(400, "Repositorio de archivos desconocido.");
  return getStore(bucket);
}

function cleanPath(path: string | null) {
  if (!path || path.includes("..")) throw new HttpError(400, "Ruta de archivo no válida.");
  return path.replace(/^\/+/, "");
}

/** Los documentos se guardan como `<id estudiante>/<archivo>`; se verifica el acceso a ese estudiante. */
async function assertCanReadFile(path: string) {
  const account = await requireAccount();
  if (account.role === "encargado" || account.role === "educadora") return;
  if (account.role === "apoderado") {
    const studentId = path.split("/")[0];
    const email = account.profile.email ?? account.user.email ?? "";
    const res = await pool().query(
      `SELECT 1 FROM guardians WHERE student_id::text = $1 AND lower(email) = lower($2) LIMIT 1`,
      [studentId, email],
    );
    if (res.rows.length) return;
  }
  throw new HttpError(403, "No tienes acceso a este documento.");
}

export const Route = createFileRoute("/api/files")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handle(request, async () => {
          const url = new URL(request.url);
          const store = bucketStore(url.searchParams.get("bucket"));
          const path = cleanPath(url.searchParams.get("path"));
          await assertCanReadFile(path);
          const file = await store.get(path, { type: "arrayBuffer" });
          if (!file) throw new HttpError(404, "Documento no encontrado.");
          const ext = path.split(".").pop()?.toLowerCase() ?? "";
          return new Response(file, {
            headers: {
              "Content-Type": MIME[ext] ?? "application/octet-stream",
              "Content-Disposition": `inline; filename="${encodeURIComponent(path.split("/").pop() ?? "documento")}"`,
              "Cache-Control": "private, no-store",
            },
          });
        }),
      POST: ({ request }) =>
        handle(
          request,
          async () => {
            await requireAdmin();
            const form = await request.formData();
            const store = bucketStore(String(form.get("bucket") ?? ""));
            const path = cleanPath(String(form.get("path") ?? ""));
            const file = form.get("file");
            if (!(file instanceof File)) throw new HttpError(400, "Falta el archivo.");
            if (file.size > 20 * 1024 * 1024) throw new HttpError(413, "El archivo supera los 20 MB.");
            await store.set(path, await file.arrayBuffer());
            return { data: { path } };
          },
          { mutation: true },
        ),
      DELETE: ({ request }) =>
        handle(
          request,
          async () => {
            await requireAdmin();
            const { bucket, paths } = (await request.json()) as { bucket: string; paths: string[] };
            const store = bucketStore(bucket);
            await Promise.all(paths.map((p) => store.delete(cleanPath(p))));
            return { data: paths };
          },
          { mutation: true },
        ),
    },
  },
});
