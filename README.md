# Gestión Escolar Paihuen

Plataforma escolar: matrícula y ficha estudiantil, salud escolar, asistencia diaria por curso y revisión mensual con exportación Excel para SIGE.

**Tecnologías:** TanStack Start, React 19, Tailwind 4, Netlify Identity, Netlify Database (Postgres + Drizzle) y Netlify Blobs.

## Desarrollo local
```sh
pnpm install
netlify dev --port 8889
```
El inicio de sesión con Identity solo funciona en un deploy de Netlify (preview o producción).

## Acceso
Toda la plataforma exige iniciar sesión: al entrar se abre `/auth` y no se puede navegar a otras secciones sin una sesión activa. Desde "¿Olvidaste tu contraseña?" llega un enlace por correo que abre la pantalla para definir la nueva clave e ingresa automáticamente.

## Primer uso
Al entrar a `/auth` sin un Administrador creado, aparece la pantalla para crear la cuenta del Encargado. Desde Administración se dan de alta educadoras y apoderados.

## Pendiente
Ver `PLAN.md`.
