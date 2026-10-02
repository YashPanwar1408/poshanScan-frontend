import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Camera, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RequireRole, WorkerShell } from "@/components/Screen";
export const Route = createFileRoute("/app/scan")({
  head: () => ({
    meta: [
      { title: "New screening — PoshanScan" },
      { name: "description", content: "Start a guided child nutrition screening." },
      { property: "og:title", content: "New screening — PoshanScan" },
      { property: "og:description", content: "Start a guided child nutrition screening." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireRole allowed={["worker"]}>
      <WorkerShell title="New screening">
        <div className="max-w-2xl">
          <p className="text-lg text-muted-foreground">
            Find an existing child or register a new one before taking a photo.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <Link
              to="/app/children"
              search={{ register: false }}
              className="panel group p-7 hover:border-primary"
            >
              <Search className="text-primary" size={28} />
              <h2 className="mt-8 text-xl font-semibold">Find a child</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Search records and begin screening.
              </p>
              <ArrowRight className="mt-8 text-primary" />
            </Link>
            <Link
              to="/app/children"
              search={{ register: true }}
              className="panel group p-7 hover:border-primary"
            >
              <Camera className="text-primary" size={28} />
              <h2 className="mt-8 text-xl font-semibold">Register a child</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Add a child before capturing a screening.
              </p>
              <ArrowRight className="mt-8 text-primary" />
            </Link>
          </div>
        </div>
      </WorkerShell>
    </RequireRole>
  ),
});
