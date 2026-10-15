import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/supervisor/login")({
  head: () => ({
    meta: [
      { title: "Supervisor Login — PoshanScan" },
      { name: "description", content: "Supervisor login page" },
    ],
  }),
  component: SupervisorLogin,
});

function SupervisorLogin() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Supervisor Login</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You can build your supervisor login form here.
        </p>
      </div>
    </div>
  );
}
