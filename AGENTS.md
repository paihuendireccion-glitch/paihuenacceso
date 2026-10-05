# AGENTS.md

## Proyecto
Gestión Escolar Paihuen: matrícula, ficha estudiantil, salud escolar, asistencia diaria y revisión/exportación Excel para SIGE. Es una migración a Netlify de una app que se hizo con Lovable y Supabase.

## Stack
TanStack Start (React 19) + Vite + Tailwind 4 + shadcn/Radix · Netlify Identity (`@netlify/identity`) · Netlify Database (Postgres, Drizzle `@beta`) · Netlify Blobs (documentos).

## Arquitectura
- `db/schema.ts` — esquema Drizzle (fuente de verdad). Las migraciones están en `netlify/database/migrations/` (la 2ª carga los datos de ejemplo). Después de cambiar el esquema, ejecuta `npx drizzle-kit generate --name <cambio>`.
- `src/integrations/backend/client.ts` — cliente para el navegador con una API parecida a la de Supabase (`backend.from().select().eq()…`, `backend.storage`). Envía la consulta a `/api/db` o `/api/files`.
- `src/backend/query.ts` — ejecutor en el servidor. Valida tablas y columnas contra el esquema y aplica los permisos por rol (reemplaza el RLS de Supabase): encargado = todo; educadora = lectura de todo y escritura solo de la asistencia de sus cursos; apoderado = solo sus estudiantes (lo vincula `guardians.email`).
- `src/backend/account.ts` — usuario de Identity → perfil y rol (tablas `profiles` y `user_roles`).
- `src/lib/*.functions.ts` — server functions (cuenta, primer administrador, invitaciones con código).
- `src/lib/role.tsx` — contexto de sesión y rol. También procesa los enlaces de correo de Identity. El `recovery_token` NO se canjea al cargar: se guarda en `sessionStorage` y `/reset-password` lo usa con `recoverPassword(token, clave)` y luego `login()` para dejar la cookie de sesión.
- `src/routes/__root.tsx` — `AppShell` exige sesión: sin usuario, todo redirige a `/auth`. Solo `/auth` y `/reset-password` (`PUBLIC_PATHS`) son públicas y se muestran sin menú.
- `src/routes/api/{db,files}.ts` — endpoints con comprobación de origen (CSRF).

## Convenciones
- La interfaz está en español. Usa el alias `@/`. Los roles se guardan en la base de datos, no en `app_metadata`.
- No uses Supabase. Todo acceso a datos pasa por `backend` o por las server functions.
- Ver `PLAN.md` para lo pendiente.
