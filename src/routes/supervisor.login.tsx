import { createFileRoute } from "@tanstack/react-router";
import { RoleLogin } from "@/components/RoleLogin";

export const Route = createFileRoute("/supervisor/login")({
  head: () => ({
    meta: [
      { title: "Supervisor login — PoshanScan" },
      { name: "description", content: "Sign in to review PoshanScan program activity and field teams." },
    ],
  }),
  component: () => <RoleLogin role="supervisor" />,
});
