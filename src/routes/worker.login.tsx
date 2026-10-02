import { createFileRoute } from "@tanstack/react-router";
import { RoleLogin } from "@/components/RoleLogin";

export const Route = createFileRoute("/worker/login")({
  head: () => ({
    meta: [
      { title: "Worker login — PoshanScan" },
      { name: "description", content: "Sign in to the PoshanScan field worker workspace." },
    ],
  }),
  component: () => <RoleLogin role="worker" />,
});
