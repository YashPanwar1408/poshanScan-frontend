import { createFileRoute } from "@tanstack/react-router";
import { AppShell, ProtectedRoute } from "@/supervisor/components/AppShell";
import { TrendsPage } from "@/supervisor/pages/TrendsPage";

export const Route = createFileRoute("/supervisor/trends")({
  head: () => ({
    meta: [{ title: "Trends — PoshanScan Supervisor" }],
  }),
  component: () => (
    <ProtectedRoute>
      <AppShell title="Trends">
        <TrendsPage />
      </AppShell>
    </ProtectedRoute>
  ),
});
