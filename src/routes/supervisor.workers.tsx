import { createFileRoute } from "@tanstack/react-router";
import { AppShell, ProtectedRoute } from "@/supervisor/components/AppShell";
import { WorkersPage } from "@/supervisor/pages/WorkersPage";

export const Route = createFileRoute("/supervisor/workers")({
  head: () => ({
    meta: [{ title: "Workers — PoshanScan Supervisor" }],
  }),
  component: () => (
    <ProtectedRoute>
      <AppShell title="Workers">
        <WorkersPage />
      </AppShell>
    </ProtectedRoute>
  ),
});
