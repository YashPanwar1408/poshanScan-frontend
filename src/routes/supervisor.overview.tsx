import { createFileRoute } from "@tanstack/react-router";
import { AppShell, ProtectedRoute } from "@/supervisor/components/AppShell";
import { OverviewPage } from "@/supervisor/pages/OverviewPage";

export const Route = createFileRoute("/supervisor/overview")({
  head: () => ({
    meta: [{ title: "Overview — PoshanScan Supervisor" }],
  }),
  component: () => (
    <ProtectedRoute>
      <AppShell title="Overview">
        <OverviewPage />
      </AppShell>
    </ProtectedRoute>
  ),
});
