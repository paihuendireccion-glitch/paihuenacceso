/**
 * Cliente de datos del navegador. Expone una API encadenable (`from().select().eq()…`)
 * que serializa la consulta y la envía a `/api/db`, donde el servidor valida el
 * esquema y aplica los permisos del rol del usuario. También expone `storage`
 * para los documentos guardados en Netlify Blobs (`/api/files`).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

type FilterOp = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "is" | "ilike";
type Action = "select" | "insert" | "update" | "upsert" | "delete";

export type BackendError = { message: string };
export type BackendResult<T = any> = { data: T; error: BackendError | null; count: number | null };

type Spec = {
  table: string;
  action: Action;
  columns?: string;
  filters: { col: string; op: FilterOp; value: unknown }[];
  order: { col: string; ascending: boolean }[];
  limit?: number;
  single?: "single" | "maybe";
  count?: boolean;
  head?: boolean;
  values?: unknown;
  onConflict?: string;
  returning?: string;
};

async function post<T>(url: string, init: RequestInit): Promise<BackendResult<T>> {
  try {
    const res = await fetch(url, { credentials: "same-origin", ...init });
    const body = (await res.json().catch(() => null)) as
      | { data?: T; count?: number | null; error?: BackendError }
      | null;
    if (!res.ok || body?.error) {
      return {
        data: null as T,
        count: null,
        error: { message: body?.error?.message ?? `Error ${res.status}` },
      };
    }
    return { data: (body?.data ?? null) as T, count: body?.count ?? null, error: null };
  } catch (error) {
    return {
      data: null as T,
      count: null,
      error: { message: error instanceof Error ? error.message : "Error de red" },
    };
  }
}

class QueryBuilder<T = any> implements PromiseLike<BackendResult<T>> {
  private spec: Spec;

  constructor(table: string) {
    this.spec = { table, action: "select", filters: [], order: [] };
  }

  select(columns = "*", opts?: { count?: "exact"; head?: boolean }) {
    if (this.spec.action === "select") {
      this.spec.columns = columns;
      if (opts?.count) this.spec.count = true;
      if (opts?.head) this.spec.head = true;
    } else {
      this.spec.returning = columns;
    }
    return this;
  }

  insert(values: object | object[]) {
    this.spec.action = "insert";
    this.spec.values = values;
    return this;
  }

  upsert(
    values: object | object[],
    opts?: { onConflict?: string },
  ) {
    this.spec.action = "upsert";
    this.spec.values = values;
    this.spec.onConflict = opts?.onConflict;
    return this;
  }

  update(values: object) {
    this.spec.action = "update";
    this.spec.values = values;
    return this;
  }

  delete() {
    this.spec.action = "delete";
    return this;
  }

  private filter(col: string, op: FilterOp, value: unknown) {
    this.spec.filters.push({ col, op, value });
    return this;
  }

  eq(col: string, value: unknown) {
    return this.filter(col, "eq", value);
  }
  neq(col: string, value: unknown) {
    return this.filter(col, "neq", value);
  }
  gt(col: string, value: unknown) {
    return this.filter(col, "gt", value);
  }
  gte(col: string, value: unknown) {
    return this.filter(col, "gte", value);
  }
  lt(col: string, value: unknown) {
    return this.filter(col, "lt", value);
  }
  lte(col: string, value: unknown) {
    return this.filter(col, "lte", value);
  }
  in(col: string, values: readonly unknown[]) {
    return this.filter(col, "in", values);
  }
  is(col: string, value: null | boolean) {
    return this.filter(col, "is", value);
  }
  ilike(col: string, pattern: string) {
    return this.filter(col, "ilike", pattern);
  }

  order(col: string, opts?: { ascending?: boolean }) {
    this.spec.order.push({ col, ascending: opts?.ascending ?? true });
    return this;
  }

  limit(n: number) {
    this.spec.limit = n;
    return this;
  }

  single(): PromiseLike<BackendResult<T extends (infer R)[] ? R : any>> {
    this.spec.single = "single";
    return this as any;
  }

  maybeSingle(): PromiseLike<BackendResult<any>> {
    this.spec.single = "maybe";
    return this as any;
  }

  then<R1 = BackendResult<T>, R2 = never>(
    onfulfilled?: ((value: BackendResult<T>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return post<T>("/api/db", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(this.spec),
    }).then(onfulfilled, onrejected);
  }
}

function bucket(name: string) {
  return {
    async upload(path: string, file: File | Blob) {
      const form = new FormData();
      form.set("bucket", name);
      form.set("path", path);
      form.set("file", file);
      return post<{ path: string }>("/api/files", { method: "POST", body: form });
    },
    async createSignedUrl(path: string, _expiresIn?: number) {
      const signedUrl = `/api/files?bucket=${encodeURIComponent(name)}&path=${encodeURIComponent(path)}`;
      return { data: { signedUrl }, error: null as BackendError | null };
    },
    async remove(paths: string[]) {
      return post<string[]>("/api/files", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bucket: name, paths }),
      });
    },
  };
}

export const backend = {
  from<T = any>(table: string) {
    return new QueryBuilder<T[]>(table);
  },
  storage: {
    from: bucket,
  },
};
