import { createFileRoute } from "@tanstack/react-router";

import { requireAccount } from "@/backend/account";
import { handle } from "@/backend/http";
import { runQuery, type QuerySpec } from "@/backend/query";

export const Route = createFileRoute("/api/db")({
  server: {
    handlers: {
      POST: ({ request }) =>
        handle(
          request,
          async () => {
            const account = await requireAccount();
            const spec = (await request.json()) as QuerySpec;
            return runQuery(spec, account);
          },
          { mutation: true },
        ),
    },
  },
});
