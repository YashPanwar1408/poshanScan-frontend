import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/login")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { role?: "supervisor" | "worker" | undefined } => ({
    role:
      search["role"] === "supervisor"
        ? "supervisor"
        : search["role"] === "worker"
          ? "worker"
          : undefined,
  }),
  beforeLoad: ({ search }) => {
    throw redirect({ to: search.role === "supervisor" ? "/supervisor/login" : "/worker/login" });
  },
});
