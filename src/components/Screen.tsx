import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, LogOut, UserRound, WifiOff } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Brand } from "./Brand";
import { useEffect, useState, type ReactNode } from "react";
import { listQueued, deleteQueued } from "@/lib/offline";
import { api } from "@/lib/api";
import { ThemeToggle } from "@/components/ThemeToggle";
export function RequireRole({ allowed, children }: { allowed: string[]; children: ReactNode }) {
  const { user, ready } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (ready && (!user || !allowed.includes(user.role))) navigate({ to: "/login", replace: true });
  }, [ready, user, allowed, navigate]);
  if (!ready)
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>
    );
  if (!user || !allowed.includes(user.role)) return null;
  return <>{children}</>;
}
export function WorkerShell({
  children,
  title,
  backToScreening = false,
}: {
  children: ReactNode;
  title: string;
  backToScreening?: boolean;
}) {
  const { user, logout } = useAuth();
  const [pending, setPending] = useState(0);
  useEffect(() => {
    let active = true;
    async function sync() {
      try {
        const scans = await listQueued();
        if (!active) return;
        setPending(scans.length);
        if (!navigator.onLine || !scans.length) return;
        const body = new FormData();
        body.append("metadata", JSON.stringify(scans.map(({ image, ...metadata }) => metadata)));
        scans.forEach((scan) =>
          body.append(
            "images",
            new File([scan.image], `${scan.client_scan_id}.jpg`, {
              type: scan.image.type || "image/jpeg",
            }),
          ),
        );
        await api.post("/sync", body);
        for (const scan of scans) await deleteQueued(scan.client_scan_id);
        if (active) setPending(0);
      } catch {
        /* keep queued scans for the next retry */
      }
    }
    sync();
    window.addEventListener("online", sync);
    const interval = window.setInterval(sync, 30000);
    return () => {
      active = false;
      window.removeEventListener("online", sync);
      window.clearInterval(interval);
    };
  }, []);
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Brand />
          <div className="flex items-center gap-3">
            {user?.role === "worker" && (
              <div
                className="flex items-center gap-2 border-r border-border pr-3"
                aria-label={`Signed in as ${user.name || `Worker ${user.user_id}`}`}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <UserRound size={18} aria-hidden="true" />
                </span>
                <span className="hidden min-w-0 sm:block">
                  <span className="block max-w-40 truncate text-sm font-semibold">
                    {user.name || `Worker ${user.user_id}`}
                  </span>
                  <span className="block text-xs text-muted-foreground">Field worker</span>
                </span>
              </div>
            )}
            <ThemeToggle />
            {pending > 0 && (
              <span className="flex items-center gap-1 text-xs text-warning">
                <WifiOff size={14} />
                {pending} pending sync
              </span>
            )}
            <Button
              variant="ghost"
              size="icon"
              title="Log out"
              aria-label="Log out"
              onClick={logout}
            >
              <LogOut />
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-10">
        <Link
          to={backToScreening ? "/app/scan" : "/app/children"}
          search={backToScreening ? undefined : { register: false }}
          className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft size={16} /> {backToScreening ? "Back to screening" : "All children"}
        </Link>
        <h1 className="mb-8 font-display text-3xl font-semibold">{title}</h1>
        {children}
      </main>
    </div>
  );
}
