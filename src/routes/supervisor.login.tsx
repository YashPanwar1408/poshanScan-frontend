import { createFileRoute } from "@tanstack/react-router";
import { SupervisorLoginPage } from "@/supervisor/pages/LoginPage";

export const Route = createFileRoute("/supervisor/login")({
  head: () => ({
    meta: [
      { title: "Supervisor login — PoshanScan" },
      {
        name: "description",
        content: "Sign in to the PoshanScan supervisor workspace.",
      },
    ],
  }),
  component: SupervisorLoginPage,
});
