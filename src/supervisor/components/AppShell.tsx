/**
 * AppShell — standalone wrapper for supervisor dashboard pages.
 * Import pattern: <AppShell title="Overview"><OverviewPage /></AppShell>
 */
import { useState, useEffect, useCallback, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  SquaresFour,
  ChartLineUp,
  MapTrifold,
  UsersThree,
  FlagBanner,
  FileCsv,
  ArrowsClockwise,
  Moon,
  Sun,
  SignOut,
  SidebarSimple,
  Baby,
  User,
  UsersFour,
} from "@phosphor-icons/react";
import { useSvAuth, useSvLogout, isSessionValid } from "../store/auth";
import { useSvPrefs } from "../store/prefs";
import { useFlagged } from "../api/hooks";
import { subscribeApiHealth, type ApiHealthState } from "../api/client";
import { StatusDot } from "./Primitives";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import "../styles/tokens.css";
import type { AgeCategory } from "../api/schemas";
import { CommandPalette } from "./CommandPalette";
import { Toaster } from "sonner";

// ── Nav config ────────────────────────────────────────────────────────────────

const NAV_GROUPS = [
  {
    label: "Monitor",
    items: [
      { to: "/supervisor/overview" as const, label: "Overview", Icon: SquaresFour },
      { to: "/supervisor/trends" as const, label: "Trends", Icon: ChartLineUp },
      { to: "/supervisor/locations" as const, label: "Locations", Icon: MapTrifold },
    ],
  },
  {
    label: "Operate",
    items: [
      { to: "/supervisor/workers" as const, label: "Workers", Icon: UsersThree },
      { to: "/supervisor/flagged" as const, label: "Flagged", Icon: FlagBanner, badge: true },
    ],
  },
  {
    label: "Report",
    items: [{ to: "/supervisor/reports" as const, label: "Reports", Icon: FileCsv }],
  },
] as const;

const AGE_OPTIONS: { value: AgeCategory; label: string; Icon: typeof Baby }[] = [
  { value: "child_6_59m", label: "Children 6–59m", Icon: Baby },
  { value: "adult", label: "Adults", Icon: User },
  { value: "all", label: "All", Icon: UsersFour },
];

// ── ProtectedRoute ────────────────────────────────────────────────────────────

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session } = useSvAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isValid = isSessionValid(session);

  useEffect(() => {
    if (!isValid) {
      const currentPath =
        typeof window !== "undefined"
          ? window.location.pathname + window.location.search
          : location.pathname;
      if (currentPath.includes("/supervisor/login")) return;
      const from = encodeURIComponent(currentPath);
      void navigate({
        to: "/supervisor/login",
        search: { from } as Record<string, string>,
        replace: true,
      });
    }
  }, [isValid, location.pathname, navigate]);

  if (!isValid) return null;
  return <>{children}</>;
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function Sidebar({
  collapsed,
  onToggle,
  pendingCount,
  apiHealth,
}: {
  collapsed: boolean;
  onToggle: () => void;
  pendingCount: number;
  apiHealth: ApiHealthState;
}) {
  const location = useLocation();
  const logout = useSvLogout();
  const { session } = useSvAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    void navigate({ to: "/supervisor/login", replace: true });
  }

  return (
    <aside
      className="flex shrink-0 flex-col transition-[width] duration-200 ease-in-out"
      style={{
        width: collapsed ? "var(--sv-sidebar-w-rail)" : "var(--sv-sidebar-w)",
        background: "var(--sv-ink)",
        borderRight: "1px solid var(--sv-ink-border)",
        minHeight: "100vh",
      }}
    >
      {/* Logo + collapse toggle */}
      <div
        className="flex h-14 shrink-0 items-center px-3"
        style={{
          borderBottom: "1px solid var(--sv-ink-border)",
          justifyContent: collapsed ? "center" : "space-between",
        }}
      >
        {!collapsed && (
          <Link to="/supervisor/overview" className="flex items-center gap-2.5 no-underline">
            <svg
              viewBox="0 0 32 32"
              className="size-7 shrink-0 text-[var(--sv-primary)]"
              aria-hidden
            >
              <rect width="32" height="32" fill="currentColor" />
              <polyline
                points="3.5 16 8 16 11.2 9 16 23 19.5 16 28.5 16"
                fill="none"
                stroke="#0A1B17"
                strokeWidth="2"
              />
            </svg>
            <span
              className="text-sm font-semibold text-white"
              style={{ fontFamily: "var(--sv-font-display)" }}
            >
              PoshanScan
            </span>
          </Link>
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-white/10"
          style={{ color: "var(--sv-ink-muted)" }}
        >
          <SidebarSimple size={18} />
        </button>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto py-3" aria-label="Supervisor navigation">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-1">
            {!collapsed && (
              <p
                className="px-4 pb-1 pt-3 text-[0.625rem] font-semibold uppercase tracking-widest"
                style={{
                  color: "var(--sv-ink-muted)",
                  fontFamily: "var(--sv-font-mono)",
                }}
              >
                {group.label}
              </p>
            )}
            {group.items.map((item) => {
              const isActive = location.pathname === item.to;
              const hasBadge = "badge" in item && item.badge;
              return (
                <div key={item.to} className="px-1.5">
                  <Link
                    to={item.to}
                    className={cn(
                      "relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium no-underline transition-all",
                      collapsed && "justify-center",
                    )}
                    style={
                      isActive
                        ? {
                            background: "rgba(15,107,92,0.22)",
                            color: "white",
                          }
                        : {
                            color: "var(--sv-ink-text)",
                          }
                    }
                    title={collapsed ? item.label : undefined}
                  >
                    {isActive && (
                      <span
                        className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-sm"
                        style={{ background: "var(--sv-primary)" }}
                        aria-hidden
                      />
                    )}
                    <item.Icon
                      size={18}
                      weight={isActive ? "duotone" : "regular"}
                      style={{ color: isActive ? "var(--sv-primary)" : undefined, flexShrink: 0 }}
                    />
                    {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                    {!collapsed && hasBadge && pendingCount > 0 && (
                      <span
                        className="flex size-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
                        style={{ background: "var(--sv-sam)" }}
                      >
                        {pendingCount > 99 ? "99+" : pendingCount}
                      </span>
                    )}
                  </Link>
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="space-y-2 p-3" style={{ borderTop: "1px solid var(--sv-ink-border)" }}>
        {/* API Status Pill */}
        <div
          className={cn(
            "flex items-center rounded-lg px-2 py-1.5 text-xs",
            collapsed ? "justify-center" : "justify-between",
          )}
          style={{ background: "rgba(255,255,255,0.04)" }}
          title={
            collapsed
              ? `${apiHealth.status.toUpperCase()}${apiHealth.latencyMs != null ? ` (${apiHealth.latencyMs}ms)` : ""}`
              : undefined
          }
        >
          {collapsed ? (
            <span
              className="size-2 rounded-full"
              style={{
                background:
                  apiHealth.status === "online"
                    ? "var(--sv-normal)"
                    : apiHealth.status === "slow"
                      ? "var(--sv-mam)"
                      : "var(--sv-sam)",
              }}
              aria-hidden
            />
          ) : (
            <StatusDot status={apiHealth.status} latencyMs={apiHealth.latencyMs ?? undefined} />
          )}
        </div>

        {!collapsed && session && (
          <div
            className="flex items-center gap-2.5 rounded-lg px-2 py-1.5"
            style={{ background: "rgba(255,255,255,0.03)" }}
          >
            <div
              className="flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ background: "var(--sv-primary)" }}
            >
              {(session.name[0] ?? "S").toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-white">{session.name}</p>
              <p className="text-[10px] capitalize text-[var(--sv-ink-muted)]">{session.role}</p>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors hover:bg-white/10"
          style={{
            color: "var(--sv-ink-muted)",
            justifyContent: collapsed ? "center" : "flex-start",
          }}
          title={collapsed ? "Sign out" : undefined}
        >
          <SignOut size={15} className="shrink-0" />
          {!collapsed && "Sign out"}
        </button>
      </div>
    </aside>
  );
}

// ── Topbar ────────────────────────────────────────────────────────────────────

function Topbar({
  title,
  ageCategory,
  onAgeChange,
  onRefresh,
  isRefreshing,
  lastUpdated,
  theme,
  onToggleTheme,
}: {
  title: string;
  ageCategory: AgeCategory;
  onAgeChange: (a: AgeCategory) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  lastUpdated: Date | null;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}) {
  const [elapsed, setElapsed] = useState<string>("");

  useEffect(() => {
    if (!lastUpdated) return;
    function tick() {
      if (!lastUpdated) return;
      const secs = Math.floor((Date.now() - lastUpdated.getTime()) / 1000);
      setElapsed(
        secs < 5 ? "just now" : secs < 60 ? `${secs}s ago` : `${Math.floor(secs / 60)}m ago`,
      );
    }
    tick();
    const id = setInterval(tick, 5000);
    return () => clearInterval(id);
  }, [lastUpdated]);

  return (
    <header
      className="flex h-14 shrink-0 items-center gap-3 px-5 print:hidden"
      style={{
        background: "var(--sv-surface)",
        borderBottom: "1px solid var(--sv-border)",
      }}
    >
      <h1
        className="flex-1 text-base font-semibold text-[var(--sv-text)]"
        style={{ fontFamily: "var(--sv-font-display)" }}
      >
        {title}
      </h1>

      {/* Age filter */}
      <div
        className="flex items-center gap-0.5 rounded-lg p-0.5"
        role="group"
        aria-label="Age category filter"
        style={{ background: "var(--sv-border)" }}
      >
        {AGE_OPTIONS.map((opt) => {
          const active = opt.value === ageCategory;
          return (
            <button
              key={opt.value}
              id={`sv-age-${opt.value}`}
              type="button"
              onClick={() => onAgeChange(opt.value)}
              aria-pressed={active}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all"
              style={
                active
                  ? {
                      background: "var(--sv-surface)",
                      color: "var(--sv-primary)",
                      boxShadow: "0 1px 2px rgba(0,0,0,.08)",
                    }
                  : { color: "var(--sv-muted)" }
              }
            >
              <opt.Icon size={12} weight={active ? "duotone" : "regular"} />
              <span className="hidden md:block">{opt.label}</span>
            </button>
          );
        })}
      </div>

      {/* Refresh */}
      <div className="hidden items-center gap-2 text-xs text-[var(--sv-muted)] sm:flex">
        {lastUpdated && !isRefreshing && (
          <span style={{ fontFamily: "var(--sv-font-mono)" }}>Updated {elapsed}</span>
        )}
        <button
          type="button"
          id="sv-refresh-btn"
          onClick={onRefresh}
          aria-label="Refresh data"
          className="flex size-7 items-center justify-center rounded-lg transition-colors hover:bg-[var(--sv-border)]"
          style={{ color: "var(--sv-muted)" }}
        >
          <ArrowsClockwise size={14} className={isRefreshing ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Theme toggle */}
      <button
        type="button"
        id="sv-theme-toggle"
        onClick={onToggleTheme}
        aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
        className="flex size-8 items-center justify-center rounded-lg transition-colors hover:bg-[var(--sv-border)]"
        style={{ color: "var(--sv-muted)" }}
      >
        {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
      </button>
    </header>
  );
}

// ── AppShell ──────────────────────────────────────────────────────────────────

interface AppShellProps {
  title: string;
  children: ReactNode;
}

export function AppShell({ title, children }: AppShellProps) {
  const { sidebarCollapsed, toggleSidebar, ageCategory, setAgeCategory, theme, toggleTheme } =
    useSvPrefs();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session } = useSvAuth();
  const logout = useSvLogout();

  const [apiHealth, setApiHealth] = useState<ApiHealthState>({
    status: "online",
    latencyMs: null,
    lastChecked: null,
  });

  useEffect(() => {
    return subscribeApiHealth(setApiHealth);
  }, []);

  const handleAgeChange = useCallback(
    (a: AgeCategory) => {
      setAgeCategory(a);
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.set("age", a);
        window.history.replaceState(null, "", url.toString());
      }
    },
    [setAgeCategory],
  );

  const [lastUpdated, setLastUpdated] = useState<Date | null>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ["sv"] });
      setLastUpdated(new Date());
    } finally {
      setIsRefreshing(false);
    }
  }, [queryClient]);

  // Session expiry countdown: toast 60s before expiry + auto logout at 0
  const [showExpiryWarning, setShowExpiryWarning] = useState(false);

  useEffect(() => {
    if (!session || !session.expiresAt) return;
    const checkExpiry = () => {
      const now = Date.now();
      const diff = session.expiresAt! - now;
      if (diff <= 0) {
        logout();
        void navigate({
          to: "/supervisor/login",
          search: { expired: "1" } as Record<string, string>,
          replace: true,
        });
      } else if (diff <= 60_000) {
        setShowExpiryWarning(true);
      } else {
        setShowExpiryWarning(false);
      }
    };

    checkExpiry();
    const interval = setInterval(checkExpiry, 5000);
    return () => clearInterval(interval);
  }, [session, logout, navigate]);

  // Apply theme data attribute
  useEffect(() => {
    const el = document.querySelector<HTMLElement>(".sv-root");
    if (el) el.dataset["theme"] = theme;
  }, [theme]);

  // Load age from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlAge = params.get("age") as AgeCategory | null;
    if (urlAge && ["child_6_59m", "adult", "all"].includes(urlAge)) {
      setAgeCategory(urlAge);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: flaggedData } = useFlagged("pending", ageCategory);
  const pendingCount = flaggedData?.pendingCount ?? 0;

  // Command Palette & Global Keyboard Shortcuts
  const [cmdkOpen, setCmdkOpen] = useState(false);

  useEffect(() => {
    let gPressed = false;
    let gTimer: number | null = null;

    function handleKeyDown(e: KeyboardEvent) {
      // Ignore when focused inside text inputs, textareas, selects
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      // Ctrl+K or Cmd+K
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdkOpen((v) => !v);
        return;
      }

      // ? opens command palette / shortcuts
      if (e.key === "?") {
        e.preventDefault();
        setCmdkOpen(true);
        return;
      }

      // Sequential 'g' then navigation keys
      if (e.key === "g" || e.key === "G") {
        gPressed = true;
        if (gTimer) window.clearTimeout(gTimer);
        gTimer = window.setTimeout(() => {
          gPressed = false;
        }, 1200);
        return;
      }

      if (gPressed) {
        gPressed = false;
        if (gTimer) window.clearTimeout(gTimer);
        const k = e.key.toLowerCase();
        if (k === "o") {
          e.preventDefault();
          void navigate({ to: "/supervisor/overview" });
        } else if (k === "t") {
          e.preventDefault();
          void navigate({ to: "/supervisor/trends" });
        } else if (k === "l") {
          e.preventDefault();
          void navigate({ to: "/supervisor/locations" });
        } else if (k === "w") {
          e.preventDefault();
          void navigate({ to: "/supervisor/workers" });
        } else if (k === "f") {
          e.preventDefault();
          void navigate({ to: "/supervisor/flagged" });
        } else if (k === "r") {
          e.preventDefault();
          void navigate({ to: "/supervisor/reports" });
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (gTimer) window.clearTimeout(gTimer);
    };
  }, [navigate]);

  return (
    <div className="sv-root flex h-screen overflow-hidden" data-theme={theme}>
      {/* Toast notifications */}
      <Toaster richColors position="bottom-right" />

      {/* Global Command Palette */}
      <CommandPalette open={cmdkOpen} onOpenChange={setCmdkOpen} />

      {/* Session expiry warning toast */}
      {showExpiryWarning && (
        <div
          role="alert"
          className="fixed top-4 right-4 z-50 flex items-center gap-3 rounded-lg border border-[var(--sv-mam)] bg-[var(--sv-surface)] px-4 py-3 text-xs shadow-lg"
          style={{ color: "var(--sv-text)" }}
        >
          <span
            className="flex size-2 rounded-full animate-ping"
            style={{ background: "var(--sv-mam)" }}
          />
          <div>
            <p className="font-semibold text-[var(--sv-mam)]">Session Expiring Soon</p>
            <p className="text-[var(--sv-muted)]">
              Your session will expire in less than 60 seconds.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            className="rounded px-2.5 py-1 font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--sv-primary)" }}
          >
            Stay signed in
          </button>
        </div>
      )}

      <div className="print:hidden">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={toggleSidebar}
          pendingCount={pendingCount}
          apiHealth={apiHealth}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar
          title={title}
          ageCategory={ageCategory}
          onAgeChange={handleAgeChange}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
          lastUpdated={lastUpdated}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
        <main className="flex-1 overflow-y-auto p-6 print:p-0 print:overflow-visible">
          {children}
        </main>
      </div>
    </div>
  );
}
