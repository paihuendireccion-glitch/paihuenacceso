import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getUser } from "@netlify/identity";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const user = await getUser();
    if (!user) throw redirect({ to: "/auth" });
    return { user };
  },
  component: () => <Outlet />,
});
