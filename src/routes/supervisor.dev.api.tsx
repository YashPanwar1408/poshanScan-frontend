import { createFileRoute } from "@tanstack/react-router";
import { AppShell, ProtectedRoute } from "@/supervisor/components/AppShell";
import { ApiInspectorPage } from "@/supervisor/pages/ApiInspectorPage";

// Dev-only route — not rendered in production
const isDev = import.meta.env.DEV;

export const Route = createFileRoute("/supervisor/dev/api")({
  head: () => ({
    meta: [{ title: "API Inspector — PoshanScan Supervisor Dev" }],
  }),
  component: () => {
    if (!isDev) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-sm text-gray-500">Not available in production.</p>
        </div>
      );
    }
    return (
      <ProtectedRoute>
        <AppShell title="API Inspector">
          <ApiInspectorPage />
        </AppShell>
      </ProtectedRoute>
    );
  },
});
