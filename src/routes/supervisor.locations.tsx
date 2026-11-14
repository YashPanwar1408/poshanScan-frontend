import { createFileRoute } from "@tanstack/react-router";
import { AppShell, ProtectedRoute } from "@/supervisor/components/AppShell";
import { LocationsPage } from "@/supervisor/pages/LocationsPage";

export const Route = createFileRoute("/supervisor/locations")({
  head: () => ({
    meta: [{ title: "Locations — PoshanScan Supervisor" }],
  }),
  component: () => (
    <ProtectedRoute>
      <AppShell title="Locations">
        <LocationsPage />
      </AppShell>
    </ProtectedRoute>
  ),
});
