/**
 * CommandPalette — "cmdk Quick Action Palette" (Ctrl/Cmd+K)
 * Groups:
 * - Navigate (Overview, Trends, Locations, Workers, Flagged, Reports, API Inspector)
 * - Filters (Age category, time presets)
 * - Actions (Download CSV, Refresh data, Toggle theme, Sign out)
 * - Jump to (Villages, Workers, Pending Flagged Scans from React Query cache)
 * Global shortcuts: g then o/t/l/w/f/r, ? for help sheet.
 */
import { useEffect, useState } from "react";
import { Command as CommandPrimitive } from "cmdk";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  MagnifyingGlass,
  SquaresFour,
  ChartLineUp,
  MapTrifold,
  UsersThree,
  FlagBanner,
  FileCsv,
  Code,
  Baby,
  User,
  UsersFour,
  Sun,
  Moon,
  ArrowsClockwise,
  SignOut,
  DownloadSimple,
  MapPin,
  ShieldWarning,
  Keyboard,
  X,
} from "@phosphor-icons/react";
import { useSvPrefs } from "../store/prefs";
import { useSvLogout } from "../store/auth";
import { downloadExport } from "../api/client";
import type { LocationVM, WorkerVM, FlaggedVM } from "../api/adapters";
import type { AgeCategory } from "../api/schemas";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { ageCategory, setAgeCategory, theme, toggleTheme } = useSvPrefs();
  const logout = useSvLogout();

  const [search, setSearch] = useState("");

  // Retrieve cached data for "Jump to"
  const cachedLocations =
    queryClient.getQueryData<LocationVM[]>(["sv", "locations", ageCategory]) ?? [];
  const cachedWorkers = queryClient.getQueryData<WorkerVM[]>(["sv", "workers", ageCategory]) ?? [];
  const cachedFlagged =
    queryClient.getQueryData<{ items: FlaggedVM[]; pendingCount: number }>([
      "sv",
      "flagged",
      "pending",
      ageCategory,
    ])?.items ?? [];

  // Reset search when opening
  useEffect(() => {
    if (open) setSearch("");
  }, [open]);

  function runAction(fn: () => void) {
    onOpenChange(false);
    fn();
  }

  return (
    <CommandPrimitive.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Command Menu"
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/50 backdrop-blur-xs p-4"
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl border border-[var(--sv-border)] bg-[var(--sv-surface)] shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center border-b border-[var(--sv-border)] px-3.5 py-3 gap-2.5">
          <MagnifyingGlass size={18} className="text-[var(--sv-muted)] shrink-0" />
          <CommandPrimitive.Input
            value={search}
            onValueChange={setSearch}
            placeholder="Type a command, page name, village, or worker..."
            className="w-full bg-transparent text-sm text-[var(--sv-text)] outline-none placeholder:text-[var(--sv-muted)]"
          />
          <kbd className="hidden sm:inline-block rounded bg-[var(--sv-surface-hover)] px-2 py-0.5 text-[10px] font-mono text-[var(--sv-muted)] border border-[var(--sv-border)]">
            ESC
          </kbd>
        </div>

        {/* Command Items List */}
        <CommandPrimitive.List className="max-h-80 overflow-y-auto p-2 text-xs">
          <CommandPrimitive.Empty className="py-6 text-center text-xs text-[var(--sv-muted)]">
            No matching actions, pages, or entities found.
          </CommandPrimitive.Empty>

          {/* Navigate Group */}
          <CommandPrimitive.Group
            heading="Navigation"
            className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--sv-muted)]"
          >
            <CommandPrimitive.Item
              onSelect={() => runAction(() => void navigate({ to: "/supervisor/overview" }))}
              className="flex items-center justify-between rounded-lg px-2.5 py-2 text-xs text-[var(--sv-text)] hover:bg-[var(--sv-surface-hover)] cursor-pointer aria-selected:bg-[var(--sv-surface-hover)]"
            >
              <div className="flex items-center gap-2.5">
                <SquaresFour size={16} className="text-[var(--sv-primary)]" />
                <span>Overview Dashboard</span>
              </div>
              <span className="font-mono text-[10px] text-[var(--sv-muted)]">g o</span>
            </CommandPrimitive.Item>

            <CommandPrimitive.Item
              onSelect={() => runAction(() => void navigate({ to: "/supervisor/trends" }))}
              className="flex items-center justify-between rounded-lg px-2.5 py-2 text-xs text-[var(--sv-text)] hover:bg-[var(--sv-surface-hover)] cursor-pointer aria-selected:bg-[var(--sv-surface-hover)]"
            >
              <div className="flex items-center gap-2.5">
                <ChartLineUp size={16} className="text-[var(--sv-primary)]" />
                <span>Longitudinal Trends</span>
              </div>
              <span className="font-mono text-[10px] text-[var(--sv-muted)]">g t</span>
            </CommandPrimitive.Item>

            <CommandPrimitive.Item
              onSelect={() => runAction(() => void navigate({ to: "/supervisor/locations" }))}
              className="flex items-center justify-between rounded-lg px-2.5 py-2 text-xs text-[var(--sv-text)] hover:bg-[var(--sv-surface-hover)] cursor-pointer aria-selected:bg-[var(--sv-surface-hover)]"
            >
              <div className="flex items-center gap-2.5">
                <MapTrifold size={16} className="text-[var(--sv-primary)]" />
                <span>Location Risk Map</span>
              </div>
              <span className="font-mono text-[10px] text-[var(--sv-muted)]">g l</span>
            </CommandPrimitive.Item>

            <CommandPrimitive.Item
              onSelect={() => runAction(() => void navigate({ to: "/supervisor/workers" }))}
              className="flex items-center justify-between rounded-lg px-2.5 py-2 text-xs text-[var(--sv-text)] hover:bg-[var(--sv-surface-hover)] cursor-pointer aria-selected:bg-[var(--sv-surface-hover)]"
            >
              <div className="flex items-center gap-2.5">
                <UsersThree size={16} className="text-[var(--sv-primary)]" />
                <span>Field Team Directory</span>
              </div>
              <span className="font-mono text-[10px] text-[var(--sv-muted)]">g w</span>
            </CommandPrimitive.Item>

            <CommandPrimitive.Item
              onSelect={() => runAction(() => void navigate({ to: "/supervisor/flagged" }))}
              className="flex items-center justify-between rounded-lg px-2.5 py-2 text-xs text-[var(--sv-text)] hover:bg-[var(--sv-surface-hover)] cursor-pointer aria-selected:bg-[var(--sv-surface-hover)]"
            >
              <div className="flex items-center gap-2.5">
                <FlagBanner size={16} className="text-[var(--sv-sam)]" />
                <span>Flagged Review Queue</span>
              </div>
              <span className="font-mono text-[10px] text-[var(--sv-muted)]">g f</span>
            </CommandPrimitive.Item>

            <CommandPrimitive.Item
              onSelect={() => runAction(() => void navigate({ to: "/supervisor/reports" }))}
              className="flex items-center justify-between rounded-lg px-2.5 py-2 text-xs text-[var(--sv-text)] hover:bg-[var(--sv-surface-hover)] cursor-pointer aria-selected:bg-[var(--sv-surface-hover)]"
            >
              <div className="flex items-center gap-2.5">
                <FileCsv size={16} className="text-[var(--sv-accent)]" />
                <span>Reports & Exports</span>
              </div>
              <span className="font-mono text-[10px] text-[var(--sv-muted)]">g r</span>
            </CommandPrimitive.Item>

            <CommandPrimitive.Item
              onSelect={() => runAction(() => void navigate({ to: "/supervisor/dev/api" }))}
              className="flex items-center justify-between rounded-lg px-2.5 py-2 text-xs text-[var(--sv-text)] hover:bg-[var(--sv-surface-hover)] cursor-pointer aria-selected:bg-[var(--sv-surface-hover)]"
            >
              <div className="flex items-center gap-2.5">
                <Code size={16} className="text-[var(--sv-muted)]" />
                <span>API Inspector (Dev)</span>
              </div>
            </CommandPrimitive.Item>
          </CommandPrimitive.Group>

          {/* Filters Group */}
          <CommandPrimitive.Group
            heading="Cohort & Filters"
            className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--sv-muted)] mt-2"
          >
            <CommandPrimitive.Item
              onSelect={() => runAction(() => setAgeCategory("child_6_59m"))}
              className="flex items-center justify-between rounded-lg px-2.5 py-2 text-xs text-[var(--sv-text)] hover:bg-[var(--sv-surface-hover)] cursor-pointer aria-selected:bg-[var(--sv-surface-hover)]"
            >
              <div className="flex items-center gap-2.5">
                <Baby size={16} className="text-[var(--sv-primary)]" />
                <span>Filter: Children 6–59 months (Default)</span>
              </div>
              {ageCategory === "child_6_59m" && (
                <span className="text-[10px] font-bold text-[var(--sv-primary)]">Active</span>
              )}
            </CommandPrimitive.Item>

            <CommandPrimitive.Item
              onSelect={() => runAction(() => setAgeCategory("adult"))}
              className="flex items-center justify-between rounded-lg px-2.5 py-2 text-xs text-[var(--sv-text)] hover:bg-[var(--sv-surface-hover)] cursor-pointer aria-selected:bg-[var(--sv-surface-hover)]"
            >
              <div className="flex items-center gap-2.5">
                <User size={16} className="text-[var(--sv-muted)]" />
                <span>Filter: Adults (Demo)</span>
              </div>
              {ageCategory === "adult" && (
                <span className="text-[10px] font-bold text-[var(--sv-primary)]">Active</span>
              )}
            </CommandPrimitive.Item>

            <CommandPrimitive.Item
              onSelect={() => runAction(() => setAgeCategory("all"))}
              className="flex items-center justify-between rounded-lg px-2.5 py-2 text-xs text-[var(--sv-text)] hover:bg-[var(--sv-surface-hover)] cursor-pointer aria-selected:bg-[var(--sv-surface-hover)]"
            >
              <div className="flex items-center gap-2.5">
                <UsersFour size={16} className="text-[var(--sv-muted)]" />
                <span>Filter: All records (No age filter)</span>
              </div>
              {ageCategory === "all" && (
                <span className="text-[10px] font-bold text-[var(--sv-primary)]">Active</span>
              )}
            </CommandPrimitive.Item>
          </CommandPrimitive.Group>

          {/* Actions Group */}
          <CommandPrimitive.Group
            heading="Quick Actions"
            className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--sv-muted)] mt-2"
          >
            <CommandPrimitive.Item
              onSelect={() => runAction(() => void downloadExport(ageCategory))}
              className="flex items-center justify-between rounded-lg px-2.5 py-2 text-xs text-[var(--sv-text)] hover:bg-[var(--sv-surface-hover)] cursor-pointer aria-selected:bg-[var(--sv-surface-hover)]"
            >
              <div className="flex items-center gap-2.5">
                <DownloadSimple size={16} className="text-[var(--sv-primary)]" />
                <span>Download District CSV Report</span>
              </div>
            </CommandPrimitive.Item>

            <CommandPrimitive.Item
              onSelect={() =>
                runAction(() => {
                  void queryClient.invalidateQueries({ queryKey: ["sv"] });
                })
              }
              className="flex items-center justify-between rounded-lg px-2.5 py-2 text-xs text-[var(--sv-text)] hover:bg-[var(--sv-surface-hover)] cursor-pointer aria-selected:bg-[var(--sv-surface-hover)]"
            >
              <div className="flex items-center gap-2.5">
                <ArrowsClockwise size={16} className="text-[var(--sv-primary)]" />
                <span>Refresh All Queries & Cache</span>
              </div>
            </CommandPrimitive.Item>

            <CommandPrimitive.Item
              onSelect={() => runAction(toggleTheme)}
              className="flex items-center justify-between rounded-lg px-2.5 py-2 text-xs text-[var(--sv-text)] hover:bg-[var(--sv-surface-hover)] cursor-pointer aria-selected:bg-[var(--sv-surface-hover)]"
            >
              <div className="flex items-center gap-2.5">
                {theme === "dark" ? (
                  <Sun size={16} className="text-[var(--sv-mam)]" />
                ) : (
                  <Moon size={16} className="text-[var(--sv-accent)]" />
                )}
                <span>Toggle Theme ({theme === "dark" ? "Light Mode" : "Dark Mode"})</span>
              </div>
            </CommandPrimitive.Item>

            <CommandPrimitive.Item
              onSelect={() => runAction(logout)}
              className="flex items-center justify-between rounded-lg px-2.5 py-2 text-xs text-[var(--sv-sam)] hover:bg-[var(--sv-sam)]/10 cursor-pointer aria-selected:bg-[var(--sv-sam)]/10"
            >
              <div className="flex items-center gap-2.5">
                <SignOut size={16} />
                <span>Sign Out of Portal</span>
              </div>
            </CommandPrimitive.Item>
          </CommandPrimitive.Group>

          {/* Jump To Group */}
          {(cachedLocations.length > 0 || cachedWorkers.length > 0 || cachedFlagged.length > 0) && (
            <CommandPrimitive.Group
              heading="Jump to Entity"
              className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--sv-muted)] mt-2"
            >
              {cachedFlagged.slice(0, 5).map((flag) => (
                <CommandPrimitive.Item
                  key={`flag-${flag.id}`}
                  onSelect={() =>
                    runAction(() => {
                      void navigate({
                        to: "/supervisor/flagged",
                        search: { scan: flag.id } as Record<string, string>,
                      });
                    })
                  }
                  className="flex items-center justify-between rounded-lg px-2.5 py-2 text-xs text-[var(--sv-text)] hover:bg-[var(--sv-surface-hover)] cursor-pointer aria-selected:bg-[var(--sv-surface-hover)]"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <ShieldWarning size={15} className="text-[var(--sv-sam)] shrink-0" />
                    <span className="truncate">
                      Scan {flag.referenceCode} · {flag.village} ({flag.muacMm} mm)
                    </span>
                  </div>
                  <span className="text-[10px] text-[var(--sv-sam)] font-bold shrink-0">
                    {flag.band}
                  </span>
                </CommandPrimitive.Item>
              ))}

              {cachedLocations.slice(0, 5).map((loc) => (
                <CommandPrimitive.Item
                  key={`loc-${loc.name}`}
                  onSelect={() =>
                    runAction(() => {
                      void navigate({ to: "/supervisor/locations" });
                    })
                  }
                  className="flex items-center justify-between rounded-lg px-2.5 py-2 text-xs text-[var(--sv-text)] hover:bg-[var(--sv-surface-hover)] cursor-pointer aria-selected:bg-[var(--sv-surface-hover)]"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <MapPin size={15} className="text-[var(--sv-primary)] shrink-0" />
                    <span className="truncate">{loc.name} Village</span>
                  </div>
                  <span className="text-[10px] text-[var(--sv-muted)] font-mono shrink-0">
                    {loc.totalScans} scans
                  </span>
                </CommandPrimitive.Item>
              ))}

              {cachedWorkers.slice(0, 5).map((w) => (
                <CommandPrimitive.Item
                  key={`worker-${w.id}`}
                  onSelect={() =>
                    runAction(() => {
                      void navigate({ to: "/supervisor/workers" });
                    })
                  }
                  className="flex items-center justify-between rounded-lg px-2.5 py-2 text-xs text-[var(--sv-text)] hover:bg-[var(--sv-surface-hover)] cursor-pointer aria-selected:bg-[var(--sv-surface-hover)]"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <User size={15} className="text-[var(--sv-primary)] shrink-0" />
                    <span className="truncate">{w.name} (Field Worker)</span>
                  </div>
                  <span className="text-[10px] text-[var(--sv-muted)] font-mono shrink-0">
                    {w.totalScans} scans
                  </span>
                </CommandPrimitive.Item>
              ))}
            </CommandPrimitive.Group>
          )}
        </CommandPrimitive.List>

        {/* Footer shortcuts helper */}
        <div className="flex items-center justify-between border-t border-[var(--sv-border)] px-4 py-2 text-[10px] text-[var(--sv-muted)] bg-[var(--sv-surface-hover)]/30">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="font-mono font-bold text-[var(--sv-text)]">↑↓</kbd> to navigate
            </span>
            <span>
              <kbd className="font-mono font-bold text-[var(--sv-text)]">↵</kbd> to select
            </span>
          </div>
          <span>
            <kbd className="font-mono font-bold text-[var(--sv-text)]">?</kbd> for shortcut sheet
          </span>
        </div>
      </div>
    </CommandPrimitive.Dialog>
  );
}
