import { verifyRequestOrigin } from "@netlify/identity";

import { HttpError } from "./account";

/** Convierte errores en respuestas JSON `{ error: { message } }`. */
export async function handle(request: Request, fn: () => Promise<unknown>, opts: { mutation?: boolean } = {}) {
  try {
    if (opts.mutation) {
      try {
        verifyRequestOrigin(request);
      } catch {
        throw new HttpError(403, "Origen de la petición no permitido.");
      }
    }
    const result = await fn();
    if (result instanceof Response) return result;
    return Response.json(result ?? { data: null });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 400;
    const message = error instanceof Error ? error.message : "Error inesperado";
    if (!(error instanceof HttpError)) console.error(error);
    return Response.json({ data: null, error: { message } }, { status });
  }
}
