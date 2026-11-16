import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RequireRole, WorkerShell } from "@/components/Screen";
import { api, childSchema, errorMessage, type Child, type ScanResult } from "@/lib/api";

type ChildScan = ScanResult & {
  image_url?: string;
  photo_url?: string;
  uploaded_photo_url?: string;
};

function firstValue(...values: Array<string | undefined>) {
  return values.find((value) => typeof value === "string" && value.trim().length > 0) ?? "";
}

function cachePerson(person: Child) {
  const key = `poshanscan_person_${person.id}`;
  let previous: Partial<Child> = {};
  try {
    previous = JSON.parse(sessionStorage.getItem(key) || "{}");
  } catch {
    // Replace invalid cached data with the profile currently available.
  }
  const merged = {
    ...person,
    name: firstValue(person.name, previous.name),
    dob: firstValue(person.dob, previous.dob),
    gender: firstValue(person.gender, previous.gender) as Child["gender"],
    village: firstValue(person.village, previous.village),
    guardian_name: firstValue(person.guardian_name, previous.guardian_name),
  };
  sessionStorage.setItem(key, JSON.stringify(merged));
}

export const Route = createFileRoute("/app/children")({
  validateSearch: (search: Record<string, unknown>) => ({
    register: search["register"] === true,
    age_category:
      search["age_category"] === "adult"
        ? ("adult" as const)
        : search["age_category"] === "child_6_59m"
          ? ("child_6_59m" as const)
          : undefined,
  }),
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
  const { register, age_category } = Route.useSearch();
  const isAdult = age_category === "adult";
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [history, setHistory] = useState<ChildScan[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
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
          params: {
            q: query.trim().slice(0, 100),
            age_category,
          },
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
  }, [query, age_category]);
  useEffect(() => {
    if (!selectedChild) {
      setHistory([]);
      setHistoryError("");
      return;
    }
    let active = true;
    setHistoryLoading(true);
    setHistoryError("");
    api
      .get(`/children/${encodeURIComponent(selectedChild.id)}/scans`)
      .then(({ data }) => {
        if (!active) return;
        const scans = Array.isArray(data) ? data : data.scans ?? data.results ?? [];
        setHistory(scans);
      })
      .catch((cause) => {
        if (active) setHistoryError(errorMessage(cause));
      })
      .finally(() => {
        if (active) setHistoryLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedChild]);
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
      const { data } = await api.post("/children", {
        ...valid.data,
        age_category,
      });
      const responsePerson = data.child ?? data.person ?? data;
      const created: Child = {
        id: String(responsePerson.id ?? responsePerson.child_id ?? data.id ?? data.child_id ?? ""),
        name: firstValue(responsePerson.name, valid.data.name),
        dob: firstValue(responsePerson.dob, valid.data.dob),
        gender: firstValue(responsePerson.gender, valid.data.gender) as Child["gender"],
        guardian_name: firstValue(responsePerson.guardian_name, valid.data.guardian_name),
        village: firstValue(responsePerson.village, valid.data.village),
      };
      if (!created.id) throw new Error("The API did not return an ID for the registered profile.");
      cachePerson(created);
      setItems((prev) => [created, ...prev.filter((item) => item.id !== created.id)]);
      setOpen(false);
      setForm({ name: "", dob: "", gender: "F", guardian_name: "", village: "" });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }
  return (
    <WorkerShell title={isAdult ? "Adults" : "Children"} backToScreening>
      <div className="max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-muted-foreground">
            {isAdult ? "Find an adult to start a new screening." : "Find a child to start a new screening."}
          </p>
          <Button onClick={() => setOpen((v) => !v)}>
            <Plus /> Register new {isAdult ? "adult" : "child"}
          </Button>
        </div>
        {open && (
          <form onSubmit={submit} className="panel mt-7 p-6">
            <h2 className="text-xl font-semibold">Register new {isAdult ? "adult" : "child"}</h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              {(
                [
                  ["name", isAdult ? "Adult name" : "Child name", "text"],
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
                {saving ? "Saving…" : `Save ${isAdult ? "adult" : "child"}`}
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
            placeholder={`Search ${isAdult ? "adults" : "children"} by name…`}
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
        {selectedChild && (
          <section className="panel mt-6 p-6" aria-labelledby="selected-person-heading">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="eyebrow">{isAdult ? "ADULT PROFILE" : "CHILD PROFILE"}</p>
                <h2 id="selected-person-heading" className="mt-1 font-display text-2xl font-semibold">
                  {selectedChild.name}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedChild.dob} · {selectedChild.gender} · {selectedChild.village} · Guardian: {selectedChild.guardian_name}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button asChild>
                  <Link
                    to="/app/capture/$childId"
                    params={{ childId: selectedChild.id }}
                    search={{ age_category }}
                  >
                    Start screening <ArrowRight />
                  </Link>
                </Button>
                <Button variant="ghost" size="icon" aria-label="Close profile" onClick={() => setSelectedChild(null)}>
                  <X />
                </Button>
              </div>
            </div>
            <h3 className="mt-7 text-lg font-semibold">Uploaded photos and reports</h3>
            {historyLoading ? (
              <p className="mt-4 text-sm text-muted-foreground">Loading screening history…</p>
            ) : historyError ? (
              <p role="alert" className="mt-4 rounded-md bg-danger-soft p-3 text-sm text-danger">
                Could not load this profile’s screening history: {historyError}
              </p>
            ) : history.length ? (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {history.map((scan) => {
                  const photoUrl = scan.image_url ?? scan.photo_url ?? scan.uploaded_photo_url;
                  return (
                    <article key={scan.scan_id} className="overflow-hidden rounded-md border border-border">
                      {photoUrl ? (
                        <img src={photoUrl} alt={`Uploaded screening photo from ${scan.captured_at ?? scan.created_at}`} className="aspect-video w-full bg-secondary object-contain" />
                      ) : (
                        <div className="grid aspect-video place-items-center bg-secondary px-4 text-center text-sm text-muted-foreground">
                          Photo isn’t available in the history response.
                        </div>
                      )}
                      <div className="p-4">
                        <p className="font-semibold">
                          {scan.risk_band} · {Number(scan.muac_estimate_mm).toFixed(1)} mm
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {new Date(scan.captured_at ?? scan.created_at).toLocaleString()}
                        </p>
                        <Link
                          to="/app/result/$scanId"
                          params={{ scanId: scan.scan_id }}
                          className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                        >
                          View full report <ArrowRight size={16} />
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">No completed screenings are available for this profile yet.</p>
            )}
          </section>
        )}
        <div className="mt-6 overflow-hidden rounded-md border border-border bg-card">
          {loading ? (
            <p className="p-6 text-muted-foreground">Searching…</p>
          ) : items.length ? (
            items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  cachePerson(item);
                  setSelectedChild(item);
                }}
                className="flex w-full items-center justify-between border-b border-border p-5 text-left last:border-0 hover:bg-secondary/50"
              >
                <div>
                  <p className="font-semibold">{item.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.village} · {item.guardian_name}
                  </p>
                </div>
                <ArrowRight size={18} className="text-primary" />
              </button>
            ))
          ) : (
            <p className="p-8 text-center text-muted-foreground">
              No {isAdult ? "adults" : "children"} found. Register an {isAdult ? "adult" : "child"} to get started.
            </p>
          )}
        </div>
      </div>
    </WorkerShell>
  );
}
