import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getUser, handleAuthCallback, logout, onAuthChange, type User } from "@netlify/identity";
import { useQueryClient } from "@tanstack/react-query";

import { getMyAccount } from "./account.functions";
import type { Role } from "./school";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  rut: string | null;
};

type RoleContextValue = {
  loading: boolean;
  /** Usuario de Netlify Identity conectado (o `null`). */
  session: User | null;
  user: User | null;
  profile: Profile | null;
  role: Role;
  /** La cuenta existe pero un Administrador aún no le asigna un rol. */
  hasNoRole: boolean;
  isAdmin: boolean;
  canEditHealth: boolean;
  canDeleteHealth: boolean;
  canEditStudents: boolean;
  canEditAttendance: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const RoleContext = createContext<RoleContextValue>({
  loading: true,
  session: null,
  user: null,
  profile: null,
  role: "apoderado",
  hasNoRole: false,
  isAdmin: false,
  canEditHealth: false,
  canDeleteHealth: false,
  canEditStudents: false,
  canEditAttendance: false,
  refresh: async () => {},
  signOut: async () => {},
});

const AUTH_HASH =
  /^#(confirmation_token|recovery_token|invite_token|email_change_token|access_token)=/;
export const INVITE_TOKEN_KEY = "paihuen-invite-token";
export const RECOVERY_TOKEN_KEY = "paihuen-recovery-token";

export function RoleProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<Role>("apoderado");
  const [hasNoRole, setHasNoRole] = useState(false);

  const load = useCallback(async (nextUser: User | null) => {
    setSession(nextUser);
    if (!nextUser) {
      setProfile(null);
      setRole("apoderado");
      setHasNoRole(false);
      setLoading(false);
      return;
    }
    try {
      const account = await getMyAccount();
      setProfile(account?.profile ?? null);
      setRole(account?.role ?? "apoderado");
      setHasNoRole(!!account && !account.role);
    } catch {
      setProfile(null);
      setRole("apoderado");
      setHasNoRole(false);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;

    // El enlace de recuperación se guarda sin canjear: la página de nueva contraseña lo usa
    // con `recoverPassword`, que valida el token y cambia la clave en un solo paso.
    const recoveryToken = new URLSearchParams(window.location.hash.slice(1)).get("recovery_token");
    if (recoveryToken) {
      sessionStorage.setItem(RECOVERY_TOKEN_KEY, recoveryToken);
      window.location.replace("/reset-password");
      return;
    }

    // Otros enlaces de correo (invitación, confirmación) llegan con un token en el hash.
    const callback = AUTH_HASH.test(window.location.hash)
      ? handleAuthCallback().catch(() => null)
      : Promise.resolve(null);

    callback
      .then((result) => {
        if (result?.type === "invite" && result.token) {
          sessionStorage.setItem(INVITE_TOKEN_KEY, result.token);
          active = false;
          window.location.replace("/reset-password");
          return null;
        }
        return getUser();
      })
      .then((user) => {
        if (active) void load(user);
      });

    const unsubscribe = onAuthChange((event, user) => {
      if (event !== "login" && event !== "logout" && event !== "user_updated") return;
      void load(user);
      if (event !== "logout") void queryClient.invalidateQueries();
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [load, queryClient]);

  const refresh = useCallback(async () => {
    await load(await getUser());
  }, [load]);

  const signOut = useCallback(async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await logout();
    setSession(null);
    setProfile(null);
    setRole("apoderado");
    setHasNoRole(false);
  }, [queryClient]);

  const value = useMemo<RoleContextValue>(
    () => ({
      loading,
      session,
      user: session,
      profile,
      role,
      hasNoRole,
      isAdmin: role === "encargado",
      canEditHealth: role === "encargado",
      canDeleteHealth: role === "encargado",
      canEditStudents: Boolean(session) && role === "encargado",
      canEditAttendance: Boolean(session) && !hasNoRole && role !== "apoderado",
      refresh,
      signOut,
    }),
    [loading, session, profile, role, hasNoRole, refresh, signOut],
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  return useContext(RoleContext);
}
