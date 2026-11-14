/**
 * WorkersPage — "Field team"
 * Comprehensive worker directory powered by TanStack Table.
 * Features activity status buckets, top-5 horizontal volume chart,
 * rich column cells (avatar, assigned village overflow, share bar, relative IST time, confidence gauge),
 * sorting, filtering, column visibility, client-side CSV export,
 * and a right slide-over drawer showing worker profile & pending flagged reviews.
 */
import { useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  Users,
  MagnifyingGlass,
  DownloadSimple,
  ArrowClockwise,
  CheckCircle,
  Clock,
  Moon,
  X,
  Funnel,
  WarningCircle,
  Check,
  Eye,
  CaretLeft,
  CaretRight,
  ShieldWarning,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { useWorkers, useFlagged } from "../api/hooks";
import { useSvPrefs } from "../store/prefs";
import { formatNumber, parseServerDate } from "../api/adapters";
import type { WorkerVM } from "../api/adapters";
import {
  PageHeader,
  ErrorState,
  EmptyState,
  Panel,
  Skeleton,
  SegmentedControl,
} from "../components/Primitives";
import { BandBadge } from "../components/BandBadge";

// Helper for relative time calculation with fallback
function formatRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return "Never";
  const d = parseServerDate(dateStr);
  if (!d) return "Never";
  const now = Date.now();
  const diffSec = Math.floor((now - d.getTime()) / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

function formatAbsoluteIST(dateStr?: string | null): string {
  if (!dateStr) return "No activity recorded";
  const d = parseServerDate(dateStr);
  if (!d) return "No activity recorded";
  return (
    d.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }) + " IST"
  );
}

const columnHelper = createColumnHelper<WorkerVM>();

export function WorkersPage() {
  const { ageCategory } = useSvPrefs();
  const { data: workers, isLoading, isError, error, refetch } = useWorkers(ageCategory);
  const { data: flaggedData } = useFlagged("pending", ageCategory);

  // Table State
  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sorting, setSorting] = useState<SortingState>([{ id: "totalScans", desc: true }]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [selectedWorker, setSelectedWorker] = useState<WorkerVM | null>(null);
  const [showColMenu, setShowColMenu] = useState(false);

  // Programme total scans for relative share calculation
  const programmeTotalScans = useMemo(() => {
    if (!workers) return 1;
    const sum = workers.reduce((acc, w) => acc + w.totalScans, 0);
    return sum > 0 ? sum : 1;
  }, [workers]);

  // Activity Status Buckets & Top 5 Workers
  const { activeCount, idleCount, dormantCount, neverCount, topFive } = useMemo(() => {
    if (!workers) {
      return { activeCount: 0, idleCount: 0, dormantCount: 0, neverCount: 0, topFive: [] };
    }
    let act = 0;
    let idl = 0;
    let dorm = 0;
    let nev = 0;

    for (const w of workers) {
      if (w.activityStatus === "active") act++;
      else if (w.activityStatus === "idle") idl++;
      else if (w.activityStatus === "dormant") dorm++;
      else nev++;
    }

    const sortedByVolume = [...workers].sort((a, b) => b.totalScans - a.totalScans).slice(0, 5);

    return {
      activeCount: act,
      idleCount: idl,
      dormantCount: dorm,
      neverCount: nev,
      topFive: sortedByVolume,
    };
  }, [workers]);

  // Filtered workers based on status filter
  const filteredData = useMemo(() => {
    if (!workers) return [];
    if (statusFilter === "all") return workers;
    return workers.filter((w) => w.activityStatus === statusFilter);
  }, [workers, statusFilter]);

  // Flagged scans for selected worker
  const selectedWorkerFlagged = useMemo(() => {
    if (!selectedWorker || !flaggedData?.items) return [];
    const targetName = selectedWorker.name.trim().toLowerCase();
    const targetId = selectedWorker.id.trim().toLowerCase();
    return flaggedData.items.filter(
      (item) =>
        item.workerName.trim().toLowerCase() === targetName ||
        item.workerName.trim().toLowerCase() === targetId,
    );
  }, [selectedWorker, flaggedData]);

  // TanStack Columns definition
  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        id: "name",
        header: "Worker",
        cell: (info) => {
          const w = info.row.original;
          return (
            <div className="flex items-center gap-2.5">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--sv-primary)]/15 text-xs font-bold text-[var(--sv-primary)]">
                {w.initials}
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium text-xs text-[var(--sv-text)]">{w.name}</p>
                <p className="truncate font-mono text-[11px] text-[var(--sv-muted)]">{w.phone}</p>
              </div>
            </div>
          );
        },
      }),

      columnHelper.accessor("assignedVillages", {
        id: "assignedVillages",
        header: "Assigned Villages",
        cell: (info) => {
          const villages = info.getValue();
          if (!villages || villages.length === 0) {
            return <span className="text-xs text-[var(--sv-muted)] italic">Unassigned</span>;
          }
          const visible = villages.slice(0, 2);
          const remaining = villages.length - 2;

          return (
            <div className="flex flex-wrap items-center gap-1">
              {visible.map((v) => (
                <span
                  key={v}
                  className="rounded bg-[var(--sv-surface-hover)] px-2 py-0.5 text-[11px] text-[var(--sv-text)] border border-[var(--sv-border)]/60"
                >
                  {v}
                </span>
              ))}
              {remaining > 0 && (
                <span
                  className="rounded bg-[var(--sv-primary)]/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[var(--sv-primary)] cursor-help"
                  title={villages.slice(2).join(", ")}
                >
                  +{remaining}
                </span>
              )}
            </div>
          );
        },
      }),

      columnHelper.accessor("totalScans", {
        id: "totalScans",
        header: "Total Screenings",
        cell: (info) => {
          const count = info.getValue();
          const pct = Math.min(100, (count / programmeTotalScans) * 100);
          return (
            <div className="space-y-1 w-32">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="font-bold text-[var(--sv-text)]">{formatNumber(count)}</span>
                <span className="text-[10px] text-[var(--sv-muted)]">{pct.toFixed(1)}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-[var(--sv-border)] overflow-hidden">
                <div
                  className="h-full bg-[var(--sv-primary)] rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        },
      }),

      columnHelper.accessor("rawLastActive", {
        id: "lastActive",
        header: "Last Active",
        cell: (info) => {
          const raw = info.getValue();
          const rel = formatRelativeTime(raw);
          const abs = formatAbsoluteIST(raw);
          return (
            <span className="text-xs text-[var(--sv-muted)] cursor-help" title={abs}>
              {rel}
            </span>
          );
        },
      }),

      columnHelper.accessor("avgConfidencePct", {
        id: "avgConfidencePct",
        header: "Avg Confidence",
        cell: (info) => {
          const val = info.getValue();
          const isLow = val < 60;
          return (
            <div className="flex items-center gap-2 w-24">
              <div className="h-1.5 flex-1 rounded-full bg-[var(--sv-border)] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    isLow ? "bg-[var(--sv-mam)]" : "bg-[var(--sv-normal)]"
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, val))}%` }}
                />
              </div>
              <span
                className={`font-mono text-xs font-semibold ${
                  isLow ? "text-[var(--sv-mam)]" : "text-[var(--sv-normal)]"
                }`}
              >
                {Math.round(val)}%
              </span>
            </div>
          );
        },
      }),

      columnHelper.accessor("flaggedCount", {
        id: "flaggedCount",
        header: "Flagged",
        cell: (info) => {
          const count = info.getValue();
          if (count === 0) {
            return <span className="font-mono text-xs text-[var(--sv-muted)]">0</span>;
          }
          return (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--sv-sam)]/15 px-2 py-0.5 font-mono text-xs font-bold text-[var(--sv-sam)]">
              <ShieldWarning size={12} />
              {count}
            </span>
          );
        },
      }),

      columnHelper.accessor("activityStatus", {
        id: "activityStatus",
        header: "Status",
        cell: (info) => {
          const status = info.getValue();
          let dot = "bg-[var(--sv-muted)]";
          let label = "Never";
          let text = "text-[var(--sv-muted)]";

          if (status === "active") {
            dot = "bg-[var(--sv-normal)]";
            label = "Active";
            text = "text-[var(--sv-normal)]";
          } else if (status === "idle") {
            dot = "bg-[var(--sv-mam)]";
            label = "Idle";
            text = "text-[var(--sv-mam)]";
          } else if (status === "dormant") {
            dot = "bg-[var(--sv-muted)]";
            label = "Dormant";
            text = "text-[var(--sv-muted)]";
          }

          return (
            <div className={`inline-flex items-center gap-1.5 text-xs font-medium ${text}`}>
              <span className={`size-2 rounded-full ${dot}`} />
              <span>{label}</span>
            </div>
          );
        },
      }),
    ],
    [programmeTotalScans],
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      globalFilter,
      sorting,
      columnVisibility,
    },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 25,
      },
    },
  });

  // Client-side CSV export of current filtered view
  function exportCsv() {
    const rows = table.getFilteredRowModel().rows;
    if (rows.length === 0) return;

    const headers = [
      "Worker ID",
      "Name",
      "Phone",
      "Total Screenings",
      "Last Active",
      "Avg Confidence %",
      "Flagged Count",
      "Activity Status",
      "Assigned Villages",
    ];

    const csvLines = [headers.join(",")];
    for (const r of rows) {
      const w = r.original;
      const row = [
        `"${w.id}"`,
        `"${w.name.replace(/"/g, '""')}"`,
        `"${w.phone}"`,
        w.totalScans,
        `"${formatAbsoluteIST(w.rawLastActive)}"`,
        w.avgConfidencePct,
        w.flaggedCount,
        w.activityStatus,
        `"${w.assignedVillages.join("; ")}"`,
      ];
      csvLines.push(row.join(","));
    }

    const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.setAttribute("download", `poshanscan-workers-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Workers"
        description="Field team directory · Activity surveillance & performance tracking"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--sv-border)] bg-[var(--sv-surface)] px-3 py-1.5 text-xs font-medium text-[var(--sv-text)] transition hover:bg-[var(--sv-surface-hover)]"
            >
              <DownloadSimple size={14} />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={() => void refetch()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--sv-border)] bg-[var(--sv-surface)] px-3 py-1.5 text-xs font-medium text-[var(--sv-text)] transition hover:bg-[var(--sv-surface-hover)]"
            >
              <ArrowClockwise size={14} />
              <span>Refresh</span>
            </button>
          </div>
        }
      />

      {/* Top Section: Activity Buckets (KPIs) + Top 5 Workers Chart */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Activity Chips (4 columns on desktop) */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:col-span-7">
          <Panel className="p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--sv-muted)] font-medium">Total Field Team</span>
              <Users size={16} className="text-[var(--sv-primary)]" />
            </div>
            <p className="mt-2 text-2xl font-bold font-mono text-[var(--sv-text)]">
              {workers?.length ?? 0}
            </p>
            <span className="text-[11px] text-[var(--sv-muted)]">Active registered staff</span>
          </Panel>

          <Panel className="p-3.5 flex flex-col justify-between border-l-4 border-l-[var(--sv-normal)]">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--sv-normal)] font-medium">Active (≤24h)</span>
              <CheckCircle size={16} className="text-[var(--sv-normal)]" />
            </div>
            <p className="mt-2 text-2xl font-bold font-mono text-[var(--sv-normal)]">
              {activeCount}
            </p>
            <span className="text-[11px] text-[var(--sv-muted)]">Screened today</span>
          </Panel>

          <Panel className="p-3.5 flex flex-col justify-between border-l-4 border-l-[var(--sv-mam)]">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--sv-mam)] font-medium">Idle (≤7d)</span>
              <Clock size={16} className="text-[var(--sv-mam)]" />
            </div>
            <p className="mt-2 text-2xl font-bold font-mono text-[var(--sv-mam)]">{idleCount}</p>
            <span className="text-[11px] text-[var(--sv-muted)]">Past week inactive</span>
          </Panel>

          <Panel className="p-3.5 flex flex-col justify-between border-l-4 border-l-[var(--sv-muted)]">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--sv-muted)] font-medium">Dormant (&gt;7d)</span>
              <Moon size={16} className="text-[var(--sv-muted)]" />
            </div>
            <p className="mt-2 text-2xl font-bold font-mono text-[var(--sv-muted)]">
              {dormantCount + neverCount}
            </p>
            <span className="text-[11px] text-[var(--sv-muted)]">Needs follow-up</span>
          </Panel>
        </div>

        {/* Top 5 Workers Horizontal Volume Chart (5 columns on desktop) */}
        <Panel className="p-4 lg:col-span-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[var(--sv-text)]">
              Top 5 Workers by Volume
            </span>
            <span className="text-[10px] text-[var(--sv-muted)]">Screenings</span>
          </div>

          <div className="space-y-2">
            {topFive.length === 0 ? (
              <p className="text-xs text-[var(--sv-muted)] italic">No screening volume recorded.</p>
            ) : (
              topFive.map((w, idx) => {
                const maxVol = topFive[0]?.totalScans || 1;
                const ratio = (w.totalScans / maxVol) * 100;
                return (
                  <div key={w.id} className="space-y-0.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="truncate max-w-[180px] font-medium text-[var(--sv-text)]">
                        {idx + 1}. {w.name}
                      </span>
                      <span className="font-mono text-[11px] text-[var(--sv-muted)] font-bold">
                        {formatNumber(w.totalScans)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-[var(--sv-border)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[var(--sv-primary)] transition-all"
                        style={{ width: `${ratio}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Panel>
      </div>

      {/* Main Table Panel */}
      <Panel className="overflow-hidden">
        {/* Table Filter Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--sv-border)] p-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative">
              <MagnifyingGlass
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--sv-muted)]"
              />
              <input
                type="text"
                placeholder="Search worker, phone, village..."
                value={globalFilter ?? ""}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="w-64 rounded-lg border border-[var(--sv-border)] bg-[var(--sv-surface-hover)] py-1.5 pl-8 pr-3 text-xs text-[var(--sv-text)] outline-none transition focus:border-[var(--sv-primary)]"
              />
            </div>

            {/* Status Segmented Control */}
            <SegmentedControl
              segments={[
                { value: "all", label: "All" },
                { value: "active", label: `Active (${activeCount})` },
                { value: "idle", label: `Idle (${idleCount})` },
                { value: "dormant", label: `Dormant (${dormantCount})` },
              ]}
              value={statusFilter}
              onChange={setStatusFilter}
            />
          </div>

          {/* Column Visibility Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowColMenu((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--sv-border)] bg-[var(--sv-surface)] px-2.5 py-1.5 text-xs text-[var(--sv-muted)] transition hover:text-[var(--sv-text)]"
            >
              <Eye size={14} />
              <span>Columns</span>
            </button>

            {showColMenu && (
              <div className="absolute right-0 top-full mt-1.5 z-20 w-44 rounded-lg border border-[var(--sv-border)] bg-[var(--sv-surface)] p-2 shadow-xl">
                <p className="mb-1 text-[11px] font-semibold text-[var(--sv-muted)]">
                  Toggle Columns
                </p>
                <div className="space-y-1 text-xs">
                  {table.getAllLeafColumns().map((column) => (
                    <label
                      key={column.id}
                      className="flex items-center gap-2 cursor-pointer hover:bg-[var(--sv-surface-hover)] p-1 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={column.getIsVisible()}
                        onChange={column.getToggleVisibilityHandler()}
                        className="rounded border-[var(--sv-border)] accent-[var(--sv-primary)]"
                      />
                      <span className="capitalize">{column.id}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Content States */}
        {isLoading ? (
          <div className="space-y-2 p-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="p-8">
            <ErrorState
              message={error?.message ?? "Unable to retrieve worker directory."}
              onRetry={() => void refetch()}
            />
          </div>
        ) : table.getRowModel().rows.length === 0 ? (
          <div className="py-16 text-center">
            <Users size={40} className="mx-auto mb-3 text-[var(--sv-muted)]" />
            <h3 className="text-sm font-semibold text-[var(--sv-text)]">No workers found</h3>
            <p className="mt-1 text-xs text-[var(--sv-muted)]">
              No workers match your filter criteria or search query.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs" aria-label="Field workers directory">
              <thead className="sticky top-0 bg-[var(--sv-canvas)] border-b border-[var(--sv-border)] text-[var(--sv-muted)]">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className="py-3 px-4 font-semibold select-none cursor-pointer hover:text-[var(--sv-text)]"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <div className="flex items-center gap-1.5">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {{
                            asc: <span className="text-[10px]">↑</span>,
                            desc: <span className="text-[10px]">↓</span>,
                          }[header.column.getIsSorted() as string] ?? null}
                        </div>
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-[var(--sv-border)]/50">
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedWorker(row.original)}
                    className="h-12 cursor-pointer transition hover:bg-[var(--sv-surface-hover)] focus:bg-[var(--sv-surface-hover)] focus:outline-none"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        setSelectedWorker(row.original);
                      }
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-2.5">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {table.getPageCount() > 1 && (
          <div className="flex items-center justify-between border-t border-[var(--sv-border)] px-4 py-3 text-xs text-[var(--sv-muted)]">
            <span>
              Showing {table.getRowModel().rows.length} of {table.getFilteredRowModel().rows.length}{" "}
              workers
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="inline-flex items-center gap-1 rounded border border-[var(--sv-border)] px-2 py-1 disabled:opacity-40"
              >
                <CaretLeft size={12} />
                <span>Previous</span>
              </button>
              <span className="font-mono">
                {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
              </span>
              <button
                type="button"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="inline-flex items-center gap-1 rounded border border-[var(--sv-border)] px-2 py-1 disabled:opacity-40"
              >
                <span>Next</span>
                <CaretRight size={12} />
              </button>
            </div>
          </div>
        )}
      </Panel>

      {/* Right Drawer: Worker Profile & Flagged Review List */}
      {selectedWorker && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs">
          <div className="h-full w-full max-w-md bg-[var(--sv-surface)] p-6 shadow-2xl flex flex-col justify-between overflow-y-auto border-l border-[var(--sv-border)]">
            <div className="space-y-6">
              {/* Drawer Header */}
              <div className="flex items-start justify-between border-b border-[var(--sv-border)] pb-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-11 items-center justify-center rounded-full bg-[var(--sv-primary)]/15 text-base font-bold text-[var(--sv-primary)]">
                    {selectedWorker.initials}
                  </span>
                  <div>
                    <h2 className="text-base font-bold text-[var(--sv-text)]">
                      {selectedWorker.name}
                    </h2>
                    <p className="font-mono text-xs text-[var(--sv-muted)]">
                      {selectedWorker.phone}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedWorker(null)}
                  className="rounded-lg p-1.5 text-[var(--sv-muted)] hover:bg-[var(--sv-surface-hover)] hover:text-[var(--sv-text)]"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Profile Metrics Grid */}
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="rounded-lg bg-[var(--sv-surface-hover)] p-3 border border-[var(--sv-border)]/60">
                  <p className="text-[11px] text-[var(--sv-muted)]">Total Screenings</p>
                  <p className="font-mono text-lg font-bold text-[var(--sv-text)]">
                    {formatNumber(selectedWorker.totalScans)}
                  </p>
                </div>
                <div className="rounded-lg bg-[var(--sv-surface-hover)] p-3 border border-[var(--sv-border)]/60">
                  <p className="text-[11px] text-[var(--sv-muted)]">Share of Programme</p>
                  <p className="font-mono text-lg font-bold text-[var(--sv-primary)]">
                    {((selectedWorker.totalScans / programmeTotalScans) * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="rounded-lg bg-[var(--sv-surface-hover)] p-3 border border-[var(--sv-border)]/60">
                  <p className="text-[11px] text-[var(--sv-muted)]">Average Confidence</p>
                  <p className="font-mono text-lg font-bold text-[var(--sv-normal)]">
                    {Math.round(selectedWorker.avgConfidencePct)}%
                  </p>
                </div>
                <div className="rounded-lg bg-[var(--sv-surface-hover)] p-3 border border-[var(--sv-border)]/60">
                  <p className="text-[11px] text-[var(--sv-muted)]">Flagged Reviews</p>
                  <p className="font-mono text-lg font-bold text-[var(--sv-sam)]">
                    {selectedWorker.flaggedCount}
                  </p>
                </div>
              </div>

              {/* Assigned Villages List */}
              <div>
                <h3 className="text-xs font-semibold text-[var(--sv-text)] mb-2">
                  Assigned Villages ({selectedWorker.assignedVillages.length})
                </h3>
                {selectedWorker.assignedVillages.length === 0 ? (
                  <p className="text-xs text-[var(--sv-muted)] italic">
                    No designated villages assigned to this worker.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedWorker.assignedVillages.map((v) => (
                      <span
                        key={v}
                        className="rounded-md bg-[var(--sv-surface-hover)] px-2.5 py-1 text-xs text-[var(--sv-text)] border border-[var(--sv-border)]"
                      >
                        {v}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Flagged Scans awaiting review by this worker */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-[var(--sv-text)] flex items-center gap-1.5">
                    <ShieldWarning size={14} className="text-[var(--sv-sam)]" />
                    Pending Flagged Scans ({selectedWorkerFlagged.length})
                  </h3>
                  {selectedWorkerFlagged.length > 0 && (
                    <Link
                      to="/supervisor/flagged"
                      className="text-[11px] font-medium text-[var(--sv-primary)] hover:underline"
                    >
                      View All Flagged
                    </Link>
                  )}
                </div>

                {selectedWorkerFlagged.length === 0 ? (
                  <div className="rounded-lg border border-[var(--sv-border)] bg-[var(--sv-surface-hover)]/40 p-4 text-center text-xs text-[var(--sv-muted)]">
                    <CheckCircle size={24} className="mx-auto mb-1.5 text-[var(--sv-normal)]" />
                    No pending flagged scans require supervisor review for this worker.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {selectedWorkerFlagged.map((scan) => (
                      <div
                        key={scan.id}
                        className="rounded-lg border border-[var(--sv-border)] bg-[var(--sv-surface-hover)] p-2.5 text-xs flex items-center justify-between gap-2"
                      >
                        <div>
                          <p className="font-semibold text-[var(--sv-text)]">{scan.childName}</p>
                          <p className="text-[11px] text-[var(--sv-muted)]">
                            MUAC: <span className="font-mono font-bold">{scan.muacMm} mm</span> ·{" "}
                            {scan.village}
                          </p>
                        </div>
                        <div className="text-right">
                          <BandBadge band={scan.band} />
                          <p className="font-mono text-[10px] text-[var(--sv-muted)] mt-1">
                            {scan.confidencePct}% conf
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="border-t border-[var(--sv-border)] pt-4 mt-6">
              <button
                type="button"
                onClick={() => setSelectedWorker(null)}
                className="w-full rounded-lg border border-[var(--sv-border)] bg-[var(--sv-surface-hover)] py-2 text-xs font-semibold text-[var(--sv-text)] transition hover:opacity-80"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
