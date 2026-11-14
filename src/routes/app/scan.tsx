import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Camera, Search } from "lucide-react";
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
      <ScanStart />
    </RequireRole>
  ),
});
function ScanStart() {
  const [category, setCategory] = useState<"child_6_59m" | "adult" | "">("");
  return (
    <WorkerShell title="New screening">
      <div className="max-w-2xl">
        <p className="text-lg font-medium">Who is being screened?</p>
        <div
          className="mt-4 grid gap-3 sm:grid-cols-2"
          role="group"
          aria-label="Screening category"
        >
          {(
            [
              ["child_6_59m", "Child (6–59 months)"],
              ["adult", "Adult"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={category === value}
              onClick={() => {
                setCategory(value);
                sessionStorage.setItem("poshanscan_age_category", value);
              }}
              className={`panel p-5 text-left font-semibold ${category === value ? "border-primary ring-2 ring-primary" : "hover:border-primary"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Choose a category to continue. No category is selected by default.
        </p>
        <div className={category ? "" : "opacity-50"} aria-disabled={!category}>
          <p className="text-lg text-muted-foreground">
            Find an existing child or register a new one before taking a photo.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <Link
              to="/app/children"
              search={{ register: false, age_category: category || undefined }}
              aria-disabled={!category}
              tabIndex={category ? 0 : -1}
              onClick={(event) => {
                if (!category) event.preventDefault();
              }}
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
              search={{ register: true, age_category: category || undefined }}
              aria-disabled={!category}
              tabIndex={category ? 0 : -1}
              onClick={(event) => {
                if (!category) event.preventDefault();
              }}
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
      </div>
    </WorkerShell>
  );
}
