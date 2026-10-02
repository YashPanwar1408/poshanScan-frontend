import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RequireRole, WorkerShell } from "@/components/Screen";
import { api, childSchema, errorMessage, type Child } from "@/lib/api";
export const Route = createFileRoute("/app/children")({
  validateSearch: (search: Record<string, unknown>) => ({ register: search["register"] === true }),
  head: () => ({
    meta: [
      { title: "Children — PoshanScan" },
      { name: "description", content: "Find or register a child for nutrition screening." },
      { property: "og:title", content: "Children — PoshanScan" },
      { property: "og:description", content: "Find or register a child for nutrition screening." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireRole allowed={["worker"]}>
      <Children />
    </RequireRole>
  ),
});
function Children() {
  const { register } = Route.useSearch();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Child[]>([]);
  const [open, setOpen] = useState(register);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    dob: "",
    gender: "F" as "M" | "F" | "O",
    guardian_name: "",
    village: "",
  });
  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/children/search", {
          params: { q: query.trim().slice(0, 100) },
        });
        if (active) {
          setItems(Array.isArray(data) ? data : data.children || []);
          setError("");
        }
      } catch (e) {
        if (active) setError(errorMessage(e));
      } finally {
        if (active) setLoading(false);
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const valid = childSchema.safeParse(form);
    if (!valid.success) {
      setError(valid.error.issues[0]?.message || "Please check the details.");
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.post("/children", valid.data);
      setItems((prev) => [data, ...prev]);
      setOpen(false);
      setForm({ name: "", dob: "", gender: "F", guardian_name: "", village: "" });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }
  return (
    <WorkerShell title="Children">
      <div className="max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-muted-foreground">Find a child to start a new screening.</p>
          <Button onClick={() => setOpen((v) => !v)}>
            <Plus /> Register new child
          </Button>
        </div>
        {open && (
          <form onSubmit={submit} className="panel mt-7 p-6">
            <h2 className="text-xl font-semibold">Register new child</h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              {(
                [
                  ["name", "Child name", "text"],
                  ["dob", "Date of birth", "date"],
                  ["guardian_name", "Guardian name", "text"],
                  ["village", "Village", "text"],
                ] as const
              ).map(([key, label, type]) => (
                <label key={key} className="text-sm font-medium">
                  {label}
                  <input
                    className="field mt-2"
                    type={type}
                    value={form[key]}
                    onChange={(e) => setForm((v) => ({ ...v, [key]: e.target.value }))}
                    required
                    maxLength={100}
                  />
                </label>
              ))}
              <label className="text-sm font-medium">
                Gender
                <select
                  className="field mt-2"
                  value={form.gender}
                  onChange={(e) =>
                    setForm((v) => ({ ...v, gender: e.target.value as "M" | "F" | "O" }))
                  }
                >
                  <option value="F">Female</option>
                  <option value="M">Male</option>
                  <option value="O">Other</option>
                </select>
              </label>
            </div>
            <div className="mt-6 flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save child"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}
        <div className="relative mt-8">
          <Search
            size={19}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            className="field pl-12"
            aria-label="Search children"
            placeholder="Search by name…"
            value={query}
            maxLength={100}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {error && (
          <p role="alert" className="mt-5 rounded-md bg-danger-soft p-4 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="mt-6 overflow-hidden rounded-md border border-border bg-card">
          {loading ? (
            <p className="p-6 text-muted-foreground">Searching…</p>
          ) : items.length ? (
            items.map((item) => (
              <Link
                key={item.id}
                to="/app/capture/$childId"
                params={{ childId: item.id }}
                className="flex items-center justify-between border-b border-border p-5 last:border-0 hover:bg-secondary/50"
              >
                <div>
                  <p className="font-semibold">{item.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.village} · {item.guardian_name}
                  </p>
                </div>
                <ArrowRight size={18} className="text-primary" />
              </Link>
            ))
          ) : (
            <p className="p-8 text-center text-muted-foreground">
              No children found. Register a child to get started.
            </p>
          )}
        </div>
      </div>
    </WorkerShell>
  );
}
