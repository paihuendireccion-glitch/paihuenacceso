import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import {
  CalendarCheck2,
  ChevronDown,
  ClipboardList,
  FileSpreadsheet,
  FileCheck2,
  History,
  Home,
  LoaderCircle,
  LogOut,
  Settings,
  UserRound,
  Users,
} from "lucide-react";

import appCss from "../styles.css?url";
import { RoleProvider, useRole } from "../lib/role";
import { ROLE_LABEL } from "../lib/school";
import { Toaster } from "../components/ui/sonner";
import { Button } from "../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página no encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          La página que buscas no existe o fue movida.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Esta página no se pudo cargar
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ocurrió un problema. Puedes reintentar o volver al inicio.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Reintentar
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Ir al inicio
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Gestión Escolar Paihuen" },
      {
        name: "description",
        content:
          "Plataforma escolar para matrícula, salud escolar y asistencia con exportación a SIGE.",
      },
      { property: "og:title", content: "Gestión Escolar Paihuen" },
      {
        property: "og:description",
        content:
          "Matrícula y seguimiento, salud escolar y asistencia digital con exportación a SIGE.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Karla:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent as never,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

const NAV = [
  { to: "/", label: "Inicio", icon: Home },
  { to: "/estudiantes", label: "Matrícula", icon: Users },
  { to: "/asistencia", label: "Asistencia", icon: CalendarCheck2 },
  { to: "/sige", label: "Revisión SIGE", icon: FileSpreadsheet },
] as const;

const STUDENT_NAV = [
  { to: "/estudiantes/datos", label: "Ficha Estudiantil", icon: UserRound },
  { to: "/estudiantes/procesos", label: "Test Fonoaudiología y Entrevista Apoderado", icon: FileCheck2 },
  { to: "/estudiantes/movimientos", label: "Traslados", icon: History },
  { to: "/estudiantes/salud", label: "Salud Escolar", icon: ClipboardList },
] as const;

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <RoleProvider>
        <AppShell />
        <Toaster />
      </RoleProvider>
    </QueryClientProvider>
  );
}

/** Rutas que se pueden abrir sin sesión; todo lo demás redirige al ingreso. */
const PUBLIC_PATHS = ["/auth", "/reset-password"];

function AppShell() {
  const { loading, session, profile, role, isAdmin, hasNoRole, signOut } = useRole();
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isPublic = PUBLIC_PATHS.includes(pathname.replace(/\/$/, "") || "/");

  useEffect(() => {
    if (loading) return;
    if (!session && !isPublic) void router.navigate({ to: "/auth", replace: true });
    else if (session && pathname.startsWith("/auth")) void router.navigate({ to: "/", replace: true });
  }, [loading, session, isPublic, pathname, router]);

  if (loading || (!session && !isPublic)) return <FullScreenLoader />;
  if (!session) return <PublicShell />;

  const baseNav = role === "educadora" ? NAV.filter((n) => n.to !== "/estudiantes") : [...NAV];
  const nav = isAdmin ? [...baseNav, { to: "/admin", label: "Administración", icon: Settings }] : baseNav;

  async function handleSignOut() {
    await signOut();
    void router.navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="mx-auto max-w-7xl px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <Link to="/" className="flex items-center gap-3">
              <img
                src="/favicon.png"
                alt="Escuela de Lenguaje Paihuen"
                className="size-16 rounded-xl object-contain"
              />
              <span>
                <span className="block font-display text-lg font-semibold leading-tight">
                  Escuela Paihuen
                </span>
                <span className="block text-xs text-sidebar-foreground/70">
                  Matrícula · Salud · Asistencia SIGE
                </span>
              </span>
            </Link>
            <div className="flex shrink-0 items-center gap-2">
              {session && (
                <>
                  <span className="hidden text-right text-xs leading-tight sm:block">
                    <span className="block font-medium">
                      {profile?.full_name?.trim() || profile?.email || "Cuenta"}
                    </span>
                    <span className="block text-sidebar-foreground/70">
                      {hasNoRole ? "Sin rol asignado" : ROLE_LABEL[role]}
                    </span>
                  </span>
                  <Button variant="secondary" size="sm" onClick={handleSignOut}>
                    <LogOut className="size-4" />
                    Salir
                  </Button>
                </>
              )}
            </div>
          </div>
          <nav className="mt-3 flex flex-wrap gap-1">
            {nav.map(({ to, label, icon: Icon }, index) => (
              <div key={to} className="contents">
                <Link
                  to={to}
                  activeOptions={{ exact: to === "/" || to === "/estudiantes" }}
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  activeProps={{
                    className:
                      "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold bg-sidebar-accent text-sidebar-primary",
                  }}
                >
                  <Icon className="size-4" />
                  {label}
                </Link>
                {to === (role === "educadora" ? "/" : "/estudiantes") && <StudentsMenu />}
              </div>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">
        {hasNoRole && (
          <div className="mb-6 rounded-xl border border-warning/40 bg-warning/15 px-4 py-3 text-sm text-warning-foreground">
            Tu cuenta está activa, pero el Administrador aún no le asigna un rol. Cuando lo haga
            podrás ver la información del establecimiento.
          </div>
        )}
        <Outlet />
      </main>
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        Datos sensibles protegidos conforme a la Ley N.º 21.719 sobre protección de datos personales.
      </footer>
    </div>
  );
}

function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <LoaderCircle className="size-8 animate-spin text-primary" aria-label="Cargando" />
    </div>
  );
}

/** Diseño sin menú para el ingreso y el cambio de contraseña. */
function PublicShell() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <img
            src="/favicon.png"
            alt="Escuela de Lenguaje Paihuen"
            className="size-16 rounded-xl object-contain"
          />
          <span>
            <span className="block font-display text-lg font-semibold leading-tight">
              Escuela Paihuen
            </span>
            <span className="block text-xs text-sidebar-foreground/70">
              Matrícula · Salud · Asistencia SIGE
            </span>
          </span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-12">
        <Outlet />
      </main>
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        Datos sensibles protegidos conforme a la Ley N.º 21.719 sobre protección de datos personales.
      </footer>
    </div>
  );
}

function StudentsMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="gap-2 text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-primary"
        >
          <Users className="size-4" />
          Estudiantes
          <ChevronDown className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>Registros de estudiantes</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {STUDENT_NAV.map(({ to, label, icon: Icon }) => (
          <DropdownMenuItem key={to} asChild>
            <Link to={to} className="cursor-pointer py-2.5">
              <Icon className="size-4 text-primary" />
              {label}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
