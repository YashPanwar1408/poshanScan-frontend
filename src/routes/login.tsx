import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    role: search["role"] === "supervisor" ? ("supervisor" as const) : ("worker" as const),
  }),
  beforeLoad: ({ search }) => {
    throw redirect({ to: search.role === "supervisor" ? "/supervisor/login" : "/worker/login" });
  },
});
