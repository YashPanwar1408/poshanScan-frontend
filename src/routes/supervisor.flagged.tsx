import { createFileRoute } from "@tanstack/react-router";
import { AppShell, ProtectedRoute } from "@/supervisor/components/AppShell";
import { FlaggedPage } from "@/supervisor/pages/FlaggedPage";

export const Route = createFileRoute("/supervisor/flagged")({
  head: () => ({
    meta: [{ title: "Flagged Scans — PoshanScan Supervisor" }],
  }),
  component: () => (
    <ProtectedRoute>
      <AppShell title="Flagged Scans">
        <FlaggedPage />
      </AppShell>
    </ProtectedRoute>
  ),
});
