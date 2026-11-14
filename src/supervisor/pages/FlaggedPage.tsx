/**
 * FlaggedPage — "Review queue"
 * Master-detail triage workflow for SAM and low-confidence scans.
 * Features:
 * - Master-detail layout (~38% queue, ~62% detail)
 * - Tabs: Pending (n) and Reviewed (n)
 * - Search, reason chips (SAM, Low confidence), sort, bulk selection with sequential progress
 * - URL sync with ?scan=<id> for deep links from Overview
 * - Visual MUAC horizontal scale with age-specific SAM/MAM/Normal zones and threshold ticks
 * - Confidence meter, metadata grid, image panel with zoom modal and fallback
 * - Recommended clinical next steps and "Copy referral summary"
 * - Optimistic review with rollback + query invalidation (flagged + overview)
 * - Keyboard shortcuts: J/K navigation, R mark reviewed, / search, Esc clear, ? shortcut sheet
 * - Privacy protection: masked child initials with "Reveal" toggle
 */
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useSearch, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  FlagBanner,
  CheckCircle,
  MagnifyingGlass,
  CheckSquare,
  Square,
  ShieldWarning,
  User,
  MapPin,
  CalendarBlank,
  Copy,
  ArrowsClockwise,
  Warning,
  ArrowRight,
  Info,
  X,
  Sparkle,
  Camera,
  CaretLeft,
  CaretRight,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { useFlagged, useReviewFlagged, useChildrenSearch } from "../api/hooks";
import { useSvPrefs } from "../store/prefs";
import { formatNumber } from "../api/adapters";
import type { FlaggedVM } from "../api/adapters";
import {
  PageHeader,
  ErrorState,
  EmptyState,
  Panel,
  Skeleton,
  SegmentedControl,
} from "../components/Primitives";
import { BandBadge } from "../components/BandBadge";
import { getMuacBands } from "@/lib/muac";

type FlagTab = "pending" | "all_children" | "reviewed";
type ReasonFilter = "all" | "flagged" | "sam" | "mam" | "normal" | "low_confidence";
type SortOrder = "flagged_first" | "newest" | "lowest_conf" | "lowest_muac" | "name_asc";

export function FlaggedPage() {
  const { ageCategory } = useSvPrefs();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const searchParams = useSearch({ strict: false }) as { scan?: string };

  const [activeTab, setActiveTab] = useState<FlagTab>("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [reasonFilter, setReasonFilter] = useState<ReasonFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("flagged_first");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // Selected scan ID (synced to ?scan=)
  const [selectedScanId, setSelectedScanId] = useState<string | null>(searchParams.scan ?? null);
  const [selectedBulkIds, setSelectedBulkIds] = useState<Set<string>>(new Set());
  const [bulkInProgress, setBulkInProgress] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);

  // UI modals
  const [showImageZoom, setShowImageZoom] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Queries for pending, reviewed, and all children
  const pendingQuery = useFlagged("pending", ageCategory);
  const reviewedQuery = useFlagged("reviewed", ageCategory);
  const childrenSearchQuery = useChildrenSearch(searchQuery);

  const currentQuery = activeTab === "reviewed" ? reviewedQuery : pendingQuery;
  const isLoading =
    activeTab === "all_children"
      ? pendingQuery.isLoading || childrenSearchQuery.isLoading
      : currentQuery.isLoading;
  const isError =
    activeTab === "all_children"
      ? pendingQuery.isError && childrenSearchQuery.isError
      : currentQuery.isError;

  const reviewMutation = useReviewFlagged();

  // Keep URL in sync with selectedScanId
  const updateUrlScan = useCallback((id: string | null) => {
    setSelectedScanId(id);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (id) {
        url.searchParams.set("scan", id);
      } else {
        url.searchParams.delete("scan");
      }
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  // Filter and sort items
  const filteredItems = useMemo(() => {
    const isAdultCategory = ageCategory === "adult";
    const pendingItems = pendingQuery.data?.items ?? [];
    const reviewedItems = reviewedQuery.data?.items ?? [];
    const registered = isAdultCategory ? [] : (childrenSearchQuery.data ?? []);

    let items: FlaggedVM[] = [];

    if (activeTab === "pending") {
      items = pendingItems.map((i) => ({ ...i, isFlagged: true }));
      if (isAdultCategory) {
        items = items.filter(
          (i) =>
            (i as Record<string, unknown>).age_category === "adult" ||
            (i as Record<string, unknown>).ageCategory === "adult",
        );
      }
    } else if (activeTab === "reviewed") {
      items = reviewedItems;
      if (isAdultCategory) {
        items = items.filter(
          (i) =>
            (i as Record<string, unknown>).age_category === "adult" ||
            (i as Record<string, unknown>).ageCategory === "adult",
        );
      }
    } else {
      if (isAdultCategory) {
        const adultPending = pendingItems
          .filter(
            (i) =>
              (i as Record<string, unknown>).age_category === "adult" ||
              (i as Record<string, unknown>).ageCategory === "adult",
          )
          .map((i) => ({ ...i, isFlagged: true, status: "pending" }));
        const adultReviewed = reviewedItems.filter(
          (i) =>
            (i as Record<string, unknown>).age_category === "adult" ||
            (i as Record<string, unknown>).ageCategory === "adult",
        );
        items = [...adultPending, ...adultReviewed];
      } else {
        // "all_children": Combine flagged cases, reviewed cases, and registered children
        const seenIds = new Set<string>();
        const combined: FlaggedVM[] = [];

        // 1. Put pending flagged children first
        for (const p of pendingItems) {
          seenIds.add(p.id);
          if (p.childName) seenIds.add(p.childName.toLowerCase().trim());
          combined.push({ ...p, isFlagged: true, status: "pending" });
        }

        // 2. Add reviewed children
        for (const r of reviewedItems) {
          if (!seenIds.has(r.id) && (!r.childName || !seenIds.has(r.childName.toLowerCase().trim()))) {
            seenIds.add(r.id);
            if (r.childName) seenIds.add(r.childName.toLowerCase().trim());
            combined.push({ ...r, status: "reviewed" });
          }
        }

        // 3. Add registered children from search/registry
        for (const reg of registered) {
          const regNameKey = reg.name ? reg.name.toLowerCase().trim() : "";
          if (!seenIds.has(reg.id) && (!regNameKey || !seenIds.has(regNameKey))) {
            seenIds.add(reg.id);
            if (regNameKey) seenIds.add(regNameKey);
            combined.push({
              id: reg.id,
              referenceCode: reg.child_id || `REG-${reg.id.slice(0, 6).toUpperCase()}`,
              childName: reg.name || "Child Patient",
              guardianName: reg.guardian_name || null,
              gender: reg.gender || null,
              dob: reg.dob || null,
              isFlagged: false,
              muacMm: 0,
              band: "NORMAL",
              confidencePct: 0,
              createdAt: "Registered",
              rawCreatedAt: null,
              status: "registered",
              workerName: "Frontline Worker",
              village: reg.village || "—",
              imageUrl: null,
              sharpness: null,
              flagReasons: [],
            });
          }
        }

        items = combined;
      }
    }

    // Filter by reason / band
    if (reasonFilter === "flagged") {
      items = items.filter((i) => i.isFlagged || i.band.toUpperCase() === "SAM" || i.confidencePct < 60);
    } else if (reasonFilter === "sam") {
      items = items.filter((i) => i.band.toUpperCase() === "SAM");
    } else if (reasonFilter === "mam") {
      items = items.filter((i) => i.band.toUpperCase() === "MAM");
    } else if (reasonFilter === "normal") {
      items = items.filter((i) => i.band.toUpperCase() === "NORMAL" && !i.isFlagged);
    } else if (reasonFilter === "low_confidence") {
      items = items.filter((i) => i.confidencePct > 0 && i.confidencePct < 60);
    }

    // Search query filter (matching name, village, worker, reference, guardian)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      items = items.filter(
        (i) =>
          i.childName.toLowerCase().includes(q) ||
          i.referenceCode.toLowerCase().includes(q) ||
          i.village.toLowerCase().includes(q) ||
          i.workerName.toLowerCase().includes(q) ||
          (i.guardianName && i.guardianName.toLowerCase().includes(q)),
      );
    }

    // Sort items: Priority is showing flagged children first!
    return [...items].sort((a, b) => {
      if (sortOrder === "flagged_first") {
        // Flagged items always first
        const aFlagged = a.isFlagged || a.band.toUpperCase() === "SAM" || a.status === "pending";
        const bFlagged = b.isFlagged || b.band.toUpperCase() === "SAM" || b.status === "pending";
        if (aFlagged && !bFlagged) return -1;
        if (!aFlagged && bFlagged) return 1;

        // Then SAM before MAM before Normal
        const rank = (band: string) => (band.toUpperCase() === "SAM" ? 3 : band.toUpperCase() === "MAM" ? 2 : 1);
        const rankDiff = rank(b.band) - rank(a.band);
        if (rankDiff !== 0) return rankDiff;

        // Then newest
        return (b.rawCreatedAt ?? b.createdAt).localeCompare(a.rawCreatedAt ?? a.createdAt);
      }
      if (sortOrder === "name_asc") {
        return a.childName.localeCompare(b.childName);
      }
      if (sortOrder === "lowest_conf") {
        return a.confidencePct - b.confidencePct;
      }
      if (sortOrder === "lowest_muac") {
        const aVal = a.muacMm > 0 ? a.muacMm : 999;
        const bVal = b.muacMm > 0 ? b.muacMm : 999;
        return aVal - bVal;
      }
      // default: newest first
      return (b.rawCreatedAt ?? b.createdAt).localeCompare(a.rawCreatedAt ?? a.createdAt);
    });
  }, [
    activeTab,
    pendingQuery.data?.items,
    reviewedQuery.data?.items,
    childrenSearchQuery.data,
    reasonFilter,
    searchQuery,
    sortOrder,
  ]);

  // Paginated items
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, page]);

  const totalPages = Math.ceil(filteredItems.length / pageSize) || 1;

  // Auto-select first item or preserve selected scan
  useEffect(() => {
    if (filteredItems.length === 0) {
      if (selectedScanId !== null) updateUrlScan(null);
      return;
    }
    const exists = filteredItems.some((i) => i.id === selectedScanId);
    if (!exists) {
      updateUrlScan(filteredItems[0]!.id);
    }
  }, [filteredItems, selectedScanId, updateUrlScan]);

  // Selected item object
  const selectedItem = useMemo(() => {
    if (!selectedScanId) return filteredItems[0] ?? null;
    return filteredItems.find((i) => i.id === selectedScanId) ?? filteredItems[0] ?? null;
  }, [filteredItems, selectedScanId]);
  const scale = ageCategory === "all" ? getMuacBands("child_6_59m") : getMuacBands(ageCategory);
  const scaleSpan = scale.max - scale.min;
  const severeWidth = ((scale.severeBelow - scale.min) / scaleSpan) * 100;
  const moderateWidth = ((scale.moderateBelow - scale.severeBelow) / scaleSpan) * 100;
  const normalWidth = 100 - severeWidth - moderateWidth;

  // Next item selection helper
  const selectNextItem = useCallback(() => {
    if (!selectedItem || filteredItems.length <= 1) return;
    const currentIndex = filteredItems.findIndex((i) => i.id === selectedItem.id);
    if (currentIndex >= 0 && currentIndex < filteredItems.length - 1) {
      updateUrlScan(filteredItems[currentIndex + 1]!.id);
    } else if (currentIndex > 0) {
      updateUrlScan(filteredItems[currentIndex - 1]!.id);
    }
  }, [selectedItem, filteredItems, updateUrlScan]);

  const selectPrevItem = useCallback(() => {
    if (!selectedItem || filteredItems.length <= 1) return;
    const currentIndex = filteredItems.findIndex((i) => i.id === selectedItem.id);
    if (currentIndex > 0) {
      updateUrlScan(filteredItems[currentIndex - 1]!.id);
    }
  }, [selectedItem, filteredItems, updateUrlScan]);

  // Optimistic Mark as Reviewed
  const handleMarkAsReviewed = useCallback(
    async (scan: FlaggedVM) => {
      const queryKeyPending = ["sv", "flagged", "pending", ageCategory];
      const queryKeyReviewed = ["sv", "flagged", "reviewed", ageCategory];

      // Snapshot previous cache for rollback
      const prevPending = queryClient.getQueryData<{ items: FlaggedVM[]; pendingCount: number }>(
        queryKeyPending,
      );
      const prevReviewed = queryClient.getQueryData<{ items: FlaggedVM[]; pendingCount: number }>(
        queryKeyReviewed,
      );

      // Optimistically update
      if (prevPending) {
        queryClient.setQueryData(queryKeyPending, {
          items: prevPending.items.filter((i) => i.id !== scan.id),
          pendingCount: Math.max(0, prevPending.pendingCount - 1),
        });
      }
      if (prevReviewed) {
        queryClient.setQueryData(queryKeyReviewed, {
          items: [{ ...scan, status: "reviewed" }, ...prevReviewed.items],
          pendingCount: prevReviewed.pendingCount,
        });
      }

      // Auto-select next item
      selectNextItem();
      toast.success(`Scan ${scan.referenceCode} marked as reviewed`);

      try {
        await reviewMutation.mutateAsync(scan.id);
        // Invalidate queries so Overview and Sidebar badges stay synchronized
        void queryClient.invalidateQueries({ queryKey: ["sv", "flagged"] });
        void queryClient.invalidateQueries({ queryKey: ["sv", "overview"] });
      } catch (err: unknown) {
        // Rollback cache
        if (prevPending) queryClient.setQueryData(queryKeyPending, prevPending);
        if (prevReviewed) queryClient.setQueryData(queryKeyReviewed, prevReviewed);
        updateUrlScan(scan.id);

        const errObj = err as { status?: number; message?: string };
        if (errObj.status && errObj.status >= 400 && errObj.status < 500) {
          toast.error(`Scan ${scan.referenceCode} was already reviewed or updated`, {
            action: {
              label: "Refresh",
              onClick: () => {
                void currentQuery.refetch();
              },
            },
          });
        } else {
          toast.error(`Failed to review scan: ${errObj.message ?? "Server error"}`, {
            action: {
              label: "Retry",
              onClick: () => void handleMarkAsReviewed(scan),
            },
          });
        }
      }
    },
    [ageCategory, queryClient, selectNextItem, reviewMutation, updateUrlScan, currentQuery],
  );

  // Bulk Review Sequential Execution
  async function handleBulkReview() {
    const idsToReview = Array.from(selectedBulkIds);
    if (idsToReview.length === 0) return;

    setBulkInProgress(true);
    setBulkProgress({ current: 0, total: idsToReview.length });

    let succeeded = 0;
    let failed = 0;

    for (let i = 0; i < idsToReview.length; i++) {
      const id = idsToReview[i]!;
      setBulkProgress({ current: i + 1, total: idsToReview.length });
      try {
        await reviewMutation.mutateAsync(id);
        succeeded++;
      } catch {
        failed++;
      }
    }

    setBulkInProgress(false);
    setBulkProgress(null);
    setSelectedBulkIds(new Set());

    // Invalidate and refresh
    void queryClient.invalidateQueries({ queryKey: ["sv", "flagged"] });
    void queryClient.invalidateQueries({ queryKey: ["sv", "overview"] });

    if (failed === 0) {
      toast.success(`Successfully marked ${succeeded} scans as reviewed.`);
    } else {
      toast.warning(`${succeeded} reviewed, ${failed} failed.`, {
        action: {
          label: "Retry failed",
          onClick: () => void handleBulkReview(),
        },
      });
    }
  }

  function toggleBulkSelect(id: string) {
    setSelectedBulkIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedBulkIds.size === paginatedItems.length) {
      setSelectedBulkIds(new Set());
    } else {
      setSelectedBulkIds(new Set(paginatedItems.map((i) => i.id)));
    }
  }

  // Copy referral summary to clipboard
  function handleCopyReferralSummary(scan: FlaggedVM) {
    const text = [
      `PoshanScan Clinical Referral Summary`,
      `Reference: ${scan.referenceCode}`,
      `Screening Band: ${scan.band.toUpperCase()}`,
      `MUAC Estimate: ${scan.muacMm} mm`,
      `Confidence Score: ${scan.confidencePct}%`,
      `Screening Site / Village: ${scan.village}`,
      `Field Worker: ${scan.workerName}`,
      `Captured At: ${scan.createdAt}`,
      `Note: Screening aid only, confirm via clinical diagnostic assessment.`,
    ].join("\n");

    void navigator.clipboard.writeText(text);
    toast.success("Referral summary copied to clipboard");
  }

  // Keyboard shortcut listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignore if typing in input, textarea, or select
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        if (e.key === "Escape") {
          target.blur();
        }
        return;
      }

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        selectNextItem();
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        selectPrevItem();
      } else if ((e.key === "r" || e.key === "R") && activeTab === "pending" && selectedItem) {
        e.preventDefault();
        void handleMarkAsReviewed(selectedItem);
      } else if (e.key === "/") {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === "Escape") {
        setShowImageZoom(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectNextItem, selectPrevItem, activeTab, selectedItem, handleMarkAsReviewed]);

  const pendingCount = pendingQuery.data?.pendingCount ?? 0;

  return (
    <div className="space-y-4">
      {/* Page Header with Tabs */}
      <PageHeader
        title="Children & Flagged Scans"
        description="Clinical triage workbench · Review SAM cases, low-confidence screenings, and child records"
        actions={
          <SegmentedControl
            segments={[
              {
                value: "pending",
                label: `Flagged${pendingCount > 0 ? ` (${pendingCount})` : ""}`,
              },
              {
                value: "all_children",
                label: "All Children",
              },
              {
                value: "reviewed",
                label: "Reviewed",
              },
            ]}
            value={activeTab}
            onChange={(v) => {
              setActiveTab(v as FlagTab);
              setPage(1);
            }}
          />
        }
      />

      {/* Main Master-Detail Grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 min-w-0">
        {/* Left Column: Review Queue List (~38% = 5 cols) */}
        <div className="flex flex-col rounded-xl border border-[var(--sv-border)] bg-[var(--sv-surface)] overflow-hidden lg:col-span-5 h-[620px] lg:h-[calc(100vh-190px)] min-h-[520px]">
          {/* Queue Toolbar: Search, Filters, Sort */}
          <div className="border-b border-[var(--sv-border)] p-3 space-y-2.5 bg-[var(--sv-surface)]">
            <div className="relative">
              <MagnifyingGlass
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--sv-muted)]"
              />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search reference, child, village, worker..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-[var(--sv-border)] bg-[var(--sv-surface-hover)] py-1.5 pl-8 pr-3 text-xs text-[var(--sv-text)] outline-none transition focus:border-[var(--sv-primary)]"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              {/* Reason / Status Filter Chips */}
              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  onClick={() => setReasonFilter("all")}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition ${
                    reasonFilter === "all"
                      ? "bg-[var(--sv-primary)] text-white"
                      : "bg-[var(--sv-surface-hover)] text-[var(--sv-muted)] hover:text-[var(--sv-text)]"
                  }`}
                >
                  All
                </button>
                {activeTab === "all_children" && (
                  <button
                    type="button"
                    onClick={() => setReasonFilter("flagged")}
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition ${
                      reasonFilter === "flagged"
                        ? "bg-[var(--sv-sam)] text-white"
                        : "bg-[var(--sv-surface-hover)] text-[var(--sv-muted)] hover:text-[var(--sv-text)]"
                    }`}
                  >
                    Flagged Only
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setReasonFilter("sam")}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition ${
                    reasonFilter === "sam"
                      ? "bg-[var(--sv-sam)] text-white"
                      : "bg-[var(--sv-surface-hover)] text-[var(--sv-muted)] hover:text-[var(--sv-text)]"
                  }`}
                >
                  SAM
                </button>
                <button
                  type="button"
                  onClick={() => setReasonFilter(activeTab === "all_children" ? "mam" : "low_confidence")}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition ${
                    reasonFilter === (activeTab === "all_children" ? "mam" : "low_confidence")
                      ? "bg-[var(--sv-mam)] text-white"
                      : "bg-[var(--sv-surface-hover)] text-[var(--sv-muted)] hover:text-[var(--sv-text)]"
                  }`}
                >
                  {activeTab === "all_children" ? "MAM" : "<60% Conf"}
                </button>
                {activeTab === "all_children" && (
                  <button
                    type="button"
                    onClick={() => setReasonFilter("normal")}
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition ${
                      reasonFilter === "normal"
                        ? "bg-[var(--sv-normal)] text-white"
                        : "bg-[var(--sv-surface-hover)] text-[var(--sv-muted)] hover:text-[var(--sv-text)]"
                    }`}
                  >
                    Normal
                  </button>
                )}
              </div>

              {/* Sort Order */}
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                className="rounded border border-[var(--sv-border)] bg-[var(--sv-surface)] px-2 py-0.5 text-[11px] text-[var(--sv-text)] outline-none"
              >
                <option value="flagged_first">Flagged first</option>
                <option value="newest">Newest first</option>
                <option value="lowest_conf">Lowest Confidence</option>
                <option value="lowest_muac">Lowest MUAC</option>
                <option value="name_asc">Child Name (A–Z)</option>
              </select>
            </div>

            {/* Bulk Selection Toolbar (only on Pending tab) */}
            {activeTab === "pending" && paginatedItems.length > 0 && (
              <div className="flex items-center justify-between border-t border-[var(--sv-border)]/60 pt-2 text-[11px] text-[var(--sv-muted)]">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="flex items-center gap-1.5 hover:text-[var(--sv-text)] transition"
                >
                  {selectedBulkIds.size === paginatedItems.length && paginatedItems.length > 0 ? (
                    <CheckSquare size={14} className="text-[var(--sv-primary)]" weight="fill" />
                  ) : (
                    <Square size={14} />
                  )}
                  <span>Select Page ({paginatedItems.length})</span>
                </button>

                {selectedBulkIds.size > 0 && (
                  <button
                    type="button"
                    onClick={() => void handleBulkReview()}
                    disabled={bulkInProgress}
                    className="inline-flex items-center gap-1 rounded bg-[var(--sv-primary)] px-2.5 py-0.5 font-semibold text-white shadow-xs transition hover:opacity-90 disabled:opacity-50"
                  >
                    <CheckCircle size={13} weight="bold" />
                    <span>
                      {bulkInProgress && bulkProgress
                        ? `Reviewing ${bulkProgress.current}/${bulkProgress.total}...`
                        : `Mark ${selectedBulkIds.size} Reviewed`}
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Queue List Content */}
          <div className="flex-1 overflow-y-auto divide-y divide-[var(--sv-border)]/50">
            {isLoading ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            ) : isError ? (
              <div className="p-6">
                <ErrorState
                  message={
                    currentQuery.error?.message ??
                    childrenSearchQuery.error?.message ??
                    "Failed to load queue"
                  }
                  onRetry={() => {
                    void pendingQuery.refetch();
                    void reviewedQuery.refetch();
                    if (activeTab === "all_children") void childrenSearchQuery.refetch();
                  }}
                />
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="py-20 text-center p-6">
                <CheckCircle size={36} className="mx-auto mb-2 text-[var(--sv-normal)]" />
                <h3 className="text-sm font-semibold text-[var(--sv-text)]">
                  {activeTab === "pending"
                    ? "Queue clear — nothing needs review"
                    : activeTab === "all_children"
                      ? "No children records found"
                      : "No reviewed scans yet"}
                </h3>
                <p className="mt-1 text-xs text-[var(--sv-muted)]">
                  {activeTab === "pending"
                    ? "All flagged cases have been successfully assessed and addressed."
                    : activeTab === "all_children"
                      ? "Try adjusting search query or filters."
                      : "Reviewed scans will appear here after evaluation."}
                </p>
              </div>
            ) : (
              paginatedItems.map((scan) => {
                const isSelected = selectedItem?.id === scan.id;
                const isChecked = selectedBulkIds.has(scan.id);
                const isLowConf = scan.confidencePct < 60;

                return (
                  <div
                    key={scan.id}
                    onClick={() => updateUrlScan(scan.id)}
                    className={`group relative flex cursor-pointer items-start gap-2.5 p-3 text-xs transition select-none ${
                      isSelected
                        ? "bg-[var(--sv-primary)]/10 border-l-4 border-l-[var(--sv-primary)]"
                        : "hover:bg-[var(--sv-surface-hover)] border-l-4 border-l-transparent"
                    }`}
                  >
                    {/* Checkbox (pending only) */}
                    {activeTab === "pending" && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleBulkSelect(scan.id);
                        }}
                        className="mt-0.5 shrink-0 text-[var(--sv-muted)] hover:text-[var(--sv-text)]"
                      >
                        {isChecked ? (
                          <CheckSquare
                            size={15}
                            className="text-[var(--sv-primary)]"
                            weight="fill"
                          />
                        ) : (
                          <Square size={15} />
                        )}
                      </button>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-xs font-bold text-[var(--sv-text)] truncate">
                          {scan.childName}
                        </span>
                        <span className="text-[10px] text-[var(--sv-muted)] shrink-0 font-mono">
                          {scan.createdAt ? scan.createdAt.split(",")[0] : ""}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                        <BandBadge band={scan.band} size="sm" />
                        {scan.muacMm > 0 && (
                          <span className="font-mono text-xs font-bold text-[var(--sv-text)]">
                            {scan.muacMm} mm
                          </span>
                        )}
                        {scan.confidencePct > 0 && (
                          <span
                            className={`font-mono text-[10px] font-medium ${
                              isLowConf ? "text-[var(--sv-mam)]" : "text-[var(--sv-muted)]"
                            }`}
                          >
                            {scan.confidencePct}% conf
                          </span>
                        )}
                        <span className="font-mono text-[9px] text-[var(--sv-muted)] opacity-70">
                          Ref: {scan.referenceCode}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-[var(--sv-muted)] truncate">
                        <span className="flex items-center gap-1 truncate">
                          <MapPin size={11} className="shrink-0 text-[var(--sv-primary)]" />
                          <span className="truncate">{scan.village || "Unknown site"}</span>
                          {scan.guardianName && (
                            <span className="opacity-75 text-[10px] truncate">· G: {scan.guardianName}</span>
                          )}
                        </span>
                        <span className="truncate ml-2 text-[10px]">{scan.workerName}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Queue Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-[var(--sv-border)] px-3 py-2 text-xs text-[var(--sv-muted)] bg-[var(--sv-surface)]">
              <span>
                Page {page} of {totalPages} ({filteredItems.length})
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded border border-[var(--sv-border)] p-1 disabled:opacity-40"
                  aria-label="Previous page"
                >
                  <CaretLeft size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="rounded border border-[var(--sv-border)] p-1 disabled:opacity-40"
                  aria-label="Next page"
                >
                  <CaretRight size={12} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Scan Detail View (~62% = 7 cols) */}
        <div className="flex flex-col rounded-xl border border-[var(--sv-border)] bg-[var(--sv-surface)] overflow-y-auto lg:col-span-7 h-[620px] lg:h-[calc(100vh-190px)] min-h-[520px] p-6">
          {!selectedItem ? (
            <div className="flex h-full flex-col items-center justify-center text-center p-8">
              <ShieldWarning size={48} className="mb-3 text-[var(--sv-muted)]" weight="duotone" />
              <h3 className="text-base font-semibold text-[var(--sv-text)]">
                Select a scan to review
              </h3>
              <p className="mt-1 max-w-sm text-xs text-[var(--sv-muted)]">
                Choose a flagged scan from the left queue to inspect the visual MUAC scale, model
                confidence breakdown, and take clinical referral action.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Detail Header */}
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--sv-border)] pb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-bold tracking-tight text-[var(--sv-text)]">
                      {selectedItem.childName}
                    </h2>
                    <BandBadge band={selectedItem.band} />
                    {selectedItem.status === "reviewed" ? (
                      <span className="rounded-full bg-[var(--sv-normal)]/15 px-2.5 py-0.5 text-[10px] font-bold text-[var(--sv-normal)]">
                        Reviewed
                      </span>
                    ) : selectedItem.isFlagged ? (
                      <span className="rounded-full bg-[var(--sv-sam)]/15 px-2.5 py-0.5 text-[10px] font-bold text-[var(--sv-sam)]">
                        Needs Attention
                      </span>
                    ) : (
                      <span className="rounded-full bg-[var(--sv-border)] px-2.5 py-0.5 text-[10px] font-medium text-[var(--sv-muted)]">
                        Registered
                      </span>
                    )}
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-[var(--sv-muted)]">
                    <span className="font-mono">Reference: {selectedItem.referenceCode}</span>
                    <button
                      type="button"
                      onClick={() => handleCopyReferralSummary(selectedItem)}
                      className="rounded p-1 text-[var(--sv-muted)] hover:bg-[var(--sv-surface-hover)] hover:text-[var(--sv-text)] transition"
                      title="Copy referral summary"
                    >
                      <Copy size={13} />
                    </button>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <MapPin size={12} className="text-[var(--sv-primary)]" />
                      <span>{selectedItem.village}</span>
                    </span>
                    {selectedItem.guardianName && (
                      <>
                        <span>•</span>
                        <span>Guardian: {selectedItem.guardianName}</span>
                      </>
                    )}
                    {selectedItem.gender && (
                      <>
                        <span>•</span>
                        <span>Gender: {selectedItem.gender}</span>
                      </>
                    )}
                    {selectedItem.dob && (
                      <>
                        <span>•</span>
                        <span>DOB: {selectedItem.dob}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Primary Action Button */}
                {selectedItem.status === "pending" && (
                  <button
                    type="button"
                    onClick={() => void handleMarkAsReviewed(selectedItem)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--sv-primary)] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:opacity-90 active:scale-98"
                  >
                    <CheckCircle size={15} weight="bold" />
                    <span>Mark as Reviewed</span>
                  </button>
                )}
              </div>

              {/* MUAC Scale Graphic or Registered Child Notice */}
              {selectedItem.muacMm > 0 ? (
                <div className="rounded-xl border border-[var(--sv-border)] bg-[var(--sv-surface-hover)]/40 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-[var(--sv-text)]">
                      MUAC Measurement Scale (60–180 mm)
                    </span>
                    <span className="font-mono text-sm font-bold text-[var(--sv-text)]">
                      Estimate: {selectedItem.muacMm} mm
                    </span>
                  </div>

                  {/* Horizontal Graphic Container */}
                  <div className="relative pt-6 pb-4">
                    {/* Pointer Needle & Badge */}
                    {(() => {
                      const clamped = Math.max(scale.min, Math.min(scale.max, selectedItem.muacMm));
                      const pct = ((clamped - scale.min) / scaleSpan) * 100;
                      return (
                        <div
                          className="absolute top-0 -translate-x-1/2 transition-all duration-300 z-10 flex flex-col items-center pointer-events-none"
                          style={{ left: `${pct}%` }}
                        >
                          <span className="rounded bg-[var(--sv-text)] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[var(--sv-surface)] shadow">
                            {selectedItem.muacMm} mm
                          </span>
                          <div className="size-0 border-x-4 border-x-transparent border-t-4 border-t-[var(--sv-text)]" />
                        </div>
                      );
                    })()}

                    {/* Colored Scale Bar */}
                    <div className="flex h-5 w-full rounded-md overflow-hidden shadow-inner text-[10px] font-bold text-white leading-5 text-center">
                      <div
                        style={{ width: `${severeWidth}%` }}
                        className="bg-[var(--sv-sam)] transition-all flex items-center justify-center"
                        title={`SAM Band: < ${scale.severeBelow} mm`}
                      >
                        SAM (&lt;{scale.severeBelow})
                      </div>
                      <div
                        style={{ width: `${moderateWidth}%` }}
                        className="bg-[var(--sv-mam)] transition-all flex items-center justify-center text-[9px]"
                        title={`MAM Band: ${scale.severeBelow} – ${scale.moderateBelow} mm`}
                      >
                        MAM
                      </div>
                      <div
                        style={{ width: `${normalWidth}%` }}
                        className="bg-[var(--sv-normal)] transition-all flex items-center justify-center"
                        title={`Normal Band: ≥ ${scale.moderateBelow} mm`}
                      >
                        Normal (≥{scale.moderateBelow})
                      </div>
                    </div>

                    {/* Ticks & Labels */}
                    <div className="relative mt-1.5 text-[10px] font-mono text-[var(--sv-muted)] h-4">
                      <span className="absolute left-0">{scale.min} mm</span>
                      <span
                        className="absolute -translate-x-1/2 font-bold text-[var(--sv-sam)]"
                        style={{ left: `${severeWidth}%` }}
                      >
                        {scale.severeBelow} mm
                      </span>
                      <span
                        className="absolute -translate-x-1/2 font-bold text-[var(--sv-mam)]"
                        style={{ left: `${severeWidth + moderateWidth}%` }}
                      >
                        {scale.moderateBelow} mm
                      </span>
                      <span className="absolute right-0">{scale.max} mm</span>
                    </div>
                  </div>

                  {ageCategory === "adult" && (
                    <p className="mt-2 text-[11px] text-[var(--sv-muted)] italic">
                      Adult thresholds: Normal ≥230 mm, MAM 210–&lt;230 mm, SAM &lt;210 mm.
                    </p>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-[var(--sv-border)] bg-[var(--sv-surface-hover)]/30 p-4 text-xs text-[var(--sv-muted)] flex items-center gap-3">
                  <Info size={22} className="text-[var(--sv-primary)] shrink-0" />
                  <div>
                    <p className="font-semibold text-[var(--sv-text)]">Registered Child Record</p>
                    <p className="mt-0.5 text-[11px]">
                      Child is registered with normal surveillance status. No arm photo screening has been submitted yet.
                    </p>
                  </div>
                </div>
              )}

              {/* Why Flagged & Recommended Next Steps */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {/* Why Flagged or Status Note */}
                <div className="rounded-lg border border-[var(--sv-border)] bg-[var(--sv-surface)] p-3.5 space-y-2">
                  <div className="flex items-center gap-1.5 font-semibold text-[var(--sv-text)]">
                    {selectedItem.isFlagged ? (
                      <Warning size={15} className="text-[var(--sv-sam)]" />
                    ) : (
                      <CheckCircle size={15} className="text-[var(--sv-normal)]" />
                    )}
                    <span>{selectedItem.isFlagged ? "Why This Scan Was Flagged" : "Screening Status"}</span>
                  </div>
                  <ul className="space-y-1 text-[var(--sv-muted)] list-disc pl-4 text-[11px]">
                    {selectedItem.band.toUpperCase() === "SAM" && (
                      <li className="text-[var(--sv-sam)] font-medium">
                        Estimated MUAC of {selectedItem.muacMm} mm falls below the{" "}
                        {scale.severeBelow} mm SAM threshold.
                      </li>
                    )}
                    {selectedItem.confidencePct > 0 && selectedItem.confidencePct < 60 && (
                      <li className="text-[var(--sv-mam)] font-medium">
                        Model confidence score of {selectedItem.confidencePct}% is below the 60%
                        reliability threshold.
                      </li>
                    )}
                    {selectedItem.isFlagged &&
                      selectedItem.band.toUpperCase() !== "SAM" &&
                      selectedItem.confidencePct >= 60 && (
                        <li>Flagged for supervisor quality verification.</li>
                      )}
                    {!selectedItem.isFlagged && (
                      <li className="text-[var(--sv-normal)]">
                        Normal status. No clinical flags requiring urgent triage.
                      </li>
                    )}
                  </ul>
                </div>

                {/* Recommended Next Step */}
                <div className="rounded-lg border border-[var(--sv-border)] bg-[var(--sv-surface)] p-3.5 space-y-2">
                  <div className="flex items-center gap-1.5 font-semibold text-[var(--sv-text)]">
                    <ArrowRight size={15} className="text-[var(--sv-primary)]" />
                    <span>Recommended Next Step</span>
                  </div>
                  <p className="text-[11px] text-[var(--sv-muted)] leading-relaxed">
                    {selectedItem.band.toUpperCase() === "SAM"
                      ? ageCategory === "adult"
                        ? "Refer the adult promptly for clinical nutrition assessment according to your local protocol. Screening aid only — never a standalone diagnosis."
                        : "Refer the child immediately to a health facility for clinical assessment according to your local protocol. Screening aid only — never a standalone diagnosis."
                      : selectedItem.confidencePct > 0 && selectedItem.confidencePct < 60
                        ? ageCategory === "adult"
                          ? "Ask the field worker to repeat the adult measurement with a standard MUAC tape and verify camera angle, arm relaxation, and marker visibility."
                          : "Ask the field worker to repeat the child measurement with a standard Shakir tape and verify camera angle, arm relaxation, and marker visibility."
                        : "Continue routine community nutritional surveillance and follow-up screening according to schedule."}
                  </p>
                </div>
              </div>

              {/* Metadata Grid */}
              <div className="rounded-lg border border-[var(--sv-border)] p-3.5 text-xs bg-[var(--sv-surface)]">
                <span className="font-semibold text-[var(--sv-text)] block mb-2.5">
                  Screening Metadata
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <span className="text-[10px] text-[var(--sv-muted)] block">Field Worker</span>
                    <span className="font-medium text-[var(--sv-text)] truncate block">
                      {selectedItem.workerName}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--sv-muted)] block">Village / Site</span>
                    <span className="font-medium text-[var(--sv-text)] truncate block">
                      {selectedItem.village}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--sv-muted)] block">
                      Captured At (IST)
                    </span>
                    <span className="font-mono text-[11px] text-[var(--sv-text)] truncate block">
                      {selectedItem.createdAt}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--sv-muted)] block">
                      Quality / Sharpness
                    </span>
                    <span className="font-mono text-[11px] text-[var(--sv-text)] block">
                      {selectedItem.sharpness != null
                        ? `${selectedItem.sharpness} score`
                        : "Standard"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Image Panel (if image provided, else designed fallback) */}
              <div className="rounded-lg border border-[var(--sv-border)] p-3.5 bg-[var(--sv-surface)]">
                <span className="font-semibold text-xs text-[var(--sv-text)] block mb-2">
                  Arm Scan Capture Photo
                </span>
                {selectedItem.imageUrl ? (
                  <div className="relative group cursor-pointer overflow-hidden rounded-lg border border-[var(--sv-border)] bg-black/5 max-h-48 flex items-center justify-center">
                    <img
                      src={selectedItem.imageUrl}
                      alt={`Screening capture for ${selectedItem.referenceCode}`}
                      className="object-contain max-h-48 w-full transition group-hover:scale-102"
                      onClick={() => setShowImageZoom(true)}
                    />
                    <div
                      onClick={() => setShowImageZoom(true)}
                      className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition text-white font-medium text-xs gap-1"
                    >
                      <Camera size={16} />
                      <span>Click to zoom photo</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--sv-border)] bg-[var(--sv-surface-hover)]/50 py-8 text-center text-xs text-[var(--sv-muted)]">
                    <Camera size={28} className="mb-2 text-[var(--sv-muted)]" />
                    <span>Arm photo media attachment unavailable for this scan.</span>
                    <span className="text-[10px] mt-0.5 opacity-75">
                      (Secured backend storage requires authorized token access)
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Image Zoom Modal */}
      {showImageZoom && selectedItem?.imageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setShowImageZoom(false)}
        >
          <div
            className="relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-xl border border-[var(--sv-border)] bg-[var(--sv-surface)] p-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowImageZoom(false)}
              className="absolute right-3 top-3 z-10 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
              aria-label="Close zoomed image"
            >
              <X size={18} />
            </button>
            <img
              src={selectedItem.imageUrl}
              alt={selectedItem.referenceCode}
              className="max-h-[85vh] max-w-[85vw] object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
}
