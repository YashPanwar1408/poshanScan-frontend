import { createFileRoute } from "@tanstack/react-router";
import { AppShell, ProtectedRoute } from "@/supervisor/components/AppShell";
import { ReportsPage } from "@/supervisor/pages/ReportsPage";

export const Route = createFileRoute("/supervisor/reports")({
  head: () => ({
    meta: [{ title: "Reports — PoshanScan Supervisor" }],
  }),
  component: () => (
    <ProtectedRoute>
      <AppShell title="Reports">
        <ReportsPage />
      </AppShell>
    </ProtectedRoute>
  ),
});
