/**
 * Overview dashboard page — "Situation room"
 * Comprehensive overview: Live pill, auto-insight strip, 5 KPIs with 14-day sparklines and deltas,
 * risk-distribution donut, GAM/SAM rate tiles with WHO bands info, and compact panels.
 */
import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  UsersThree,
  FlagBanner,
  Pause,
  Play,
  Info,
  ArrowRight,
  Warning,
  WarningOctagon,
  ChartPieSlice,
  MapPin,
  CheckCircle,
} from "@phosphor-icons/react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { useOverview, useTrends, useLocations, useWorkers, useFlagged } from "../api/hooks";
import { useSvPrefs } from "../store/prefs";
import { KpiCard } from "../components/KpiCard";
import {
  PageHeader,
  KpiCardSkeleton,
  ErrorState,
  EmptyState,
  Panel,
  Skeleton,
} from "../components/Primitives";
import { BandBadge } from "../components/BandBadge";
import { formatNumber, computeDelta } from "../api/adapters";

const BAND_COLORS = {
  normal: "var(--sv-normal)",
  mam: "var(--sv-mam)",
  sam: "var(--sv-sam)",
};

export function OverviewPage() {
  const { ageCategory } = useSvPrefs();
  const navigate = useNavigate();

  // Queries
  const {
    data: overview,
    isLoading: overviewLoading,
    isError: overviewError,
    error: overviewErr,
    refetch: refetchOverview,
  } = useOverview(ageCategory);

  const { data: trends } = useTrends({ ageCategory, days: 30 });
  const { data: locations } = useLocations(ageCategory);
  const { data: workers } = useWorkers(ageCategory);
  const { data: flagged } = useFlagged("pending", ageCategory);

  // Live refetch toggle (every 60s, pauses when hidden)
  const [isLive, setIsLive] = useState(true);
  const [whoInfoOpen, setWhoInfoOpen] = useState(false);

  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      void refetchOverview();
    }, 60_000);
    return () => clearInterval(interval);
  }, [isLive, refetchOverview]);

  // Derived 14-day sparklines and deltas from the 30-day trends query
  const trendMetrics = useMemo(() => {
    if (!trends || trends.length < 2) return null;
    const sorted = [...trends].sort((a, b) => a.date.localeCompare(b.date));
    const last14 = sorted.slice(-14);
    const prev14 = sorted.slice(-28, -14);

    const sumMetric = (arr: typeof sorted, key: "total" | "normal" | "mam" | "sam") =>
      arr.reduce((acc, curr) => acc + (curr[key] ?? 0), 0);

    return {
      sparklines: {
        total: last14.map((p) => p.total),
        normal: last14.map((p) => p.normal),
        mam: last14.map((p) => p.mam),
        sam: last14.map((p) => p.sam),
      },
      deltas: {
        total: computeDelta(sumMetric(last14, "total"), sumMetric(prev14, "total")),
        normal: computeDelta(sumMetric(last14, "normal"), sumMetric(prev14, "normal")),
        mam: computeDelta(sumMetric(last14, "mam"), sumMetric(prev14, "mam")),
        sam: computeDelta(sumMetric(last14, "sam"), sumMetric(prev14, "sam")),
      },
    };
  }, [trends]);

  // Deterministic Insight Strip sentences
  const insights = useMemo(() => {
    if (!overview) return [];
    const facts: string[] = [];
    const total = overview.totalScans;
    const samCount = overview.samCount;
    const samPct = overview.shares.samPct;

    if (total > 0 && samCount >= 0) {
      facts.push(
        `SAM represents ${samPct.toFixed(1)}% of screenings (n=${formatNumber(samCount)} of ${formatNumber(total)}).`,
      );
    }

    if (locations && locations.length > 0) {
      // Find village with min-volume >= 5 and highest SAM rate
      const eligible = locations.filter((loc) => loc.totalScans >= 5);
      const pool = eligible.length > 0 ? eligible : locations;
      const highestSam = [...pool].sort((a, b) => b.samRate - a.samRate)[0];
      if (highestSam && highestSam.samRate > 0) {
        facts.push(
          `Highest SAM share is in ${highestSam.name} at ${highestSam.samRate}% (${highestSam.samCount} cases).`,
        );
      }
    }

    const pendingCount = flagged?.pendingCount ?? overview.flaggedPending;
    if (pendingCount > 0) {
      facts.push(
        `${pendingCount} scan${pendingCount === 1 ? "" : "s"} await clinical supervisor review.`,
      );
    }

    return facts;
  }, [overview, locations, flagged]);

  // Loading skeleton
  if (overviewLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Overview" description="Loading programme oversight data…" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <KpiCardSkeleton key={i} />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  // Error state
  if (overviewError) {
    return (
      <div className="space-y-6">
        <PageHeader title="Overview" />
        <ErrorState
          message={
            overviewErr?.message === "Response format unexpected"
              ? "Response format unexpected from supervisor overview endpoint."
              : "Unable to retrieve programme overview metrics."
          }
          detail={overviewErr?.message}
          onRetry={() => void refetchOverview()}
        />
      </div>
    );
  }

  const d = overview!;

  // Empty state if total = 0
  if (d.totalScans === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Overview"
          description={`Programme oversight · ${
            ageCategory === "child_6_59m"
              ? "Children 6–59 months"
              : ageCategory === "adult"
                ? "Adults (demo)"
                : "All age groups"
          }`}
        />
        <Panel className="p-8">
          <EmptyState
            icon={<ChartPieSlice size={36} weight="duotone" />}
            title="No screening records found"
            description={
              ageCategory !== "all"
                ? `There are currently no recorded screenings for the selected category. Try selecting "All" in the topbar.`
                : "No screenings have been submitted yet. Once field workers photograph children's upper arms, their MUAC estimates will show here."
            }
          />
        </Panel>
      </div>
    );
  }

  const gamCount = d.mamCount + d.samCount;
  const gamRate = d.totalScans > 0 ? (gamCount / d.totalScans) * 100 : 0;
  const samRate = d.totalScans > 0 ? (d.samCount / d.totalScans) * 100 : 0;

  const pieData = [
    { name: "Normal", value: d.normalCount, color: BAND_COLORS.normal },
    { name: "MAM", value: d.mamCount, color: BAND_COLORS.mam },
    { name: "SAM", value: d.samCount, color: BAND_COLORS.sam },
  ].filter((x) => x.value > 0);

  // Row 3 rankings
  const topPending = flagged?.items.slice(0, 5) ?? [];
  const topRiskVillages = (locations ?? [])
    .filter((loc) => loc.totalScans >= 5)
    .sort((a, b) => b.gamRate - a.gamRate || b.samRate - a.samRate)
    .slice(0, 5);
  const topWorkers = [...(workers ?? [])].sort((a, b) => b.totalScans - a.totalScans).slice(0, 5);

  const scopeText =
    ageCategory === "child_6_59m"
      ? "Children 6–59 months · All villages"
      : ageCategory === "adult"
        ? "Adults (demo records) · All villages"
        : "All age records · All villages";

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--sv-border)] pb-4">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight text-[var(--sv-text)]"
            style={{ fontFamily: "var(--sv-font-display)" }}
          >
            Programme Overview
          </h1>
          <p className="mt-1 text-xs text-[var(--sv-muted)]">{scopeText}</p>
        </div>
      </div>

      {/* Row 1: KPI row (5 cards) */}
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          label="Total Screenings"
          value={d.totalScans}
          subtext="Total scans"
          sparklineData={trendMetrics?.sparklines.total}
          delta={trendMetrics?.deltas.total}
          sparklineColor="var(--sv-primary)"
        />
        <KpiCard
          label="Normal Band"
          value={d.normalCount}
          subtext={`${d.shares.normalPct.toFixed(1)}% of total`}
          sparklineData={trendMetrics?.sparklines.normal}
          delta={trendMetrics?.deltas.normal}
          sparklineColor="var(--sv-normal)"
        />
        <KpiCard
          label="MAM Band"
          value={d.mamCount}
          subtext={`${d.shares.mamPct.toFixed(1)}% of total`}
          sparklineData={trendMetrics?.sparklines.mam}
          delta={trendMetrics?.deltas.mam}
          sparklineColor="var(--sv-mam)"
        />
        <KpiCard
          label="SAM Band"
          value={d.samCount}
          subtext={`${d.shares.samPct.toFixed(1)}% of total`}
          sparklineData={trendMetrics?.sparklines.sam}
          delta={trendMetrics?.deltas.sam}
          sparklineColor="var(--sv-sam)"
        />
        <KpiCard
          label="Avg Confidence"
          value={`${Math.round(d.avgConfidencePct)}%`}
          subtext="Model prediction score"
          gaugePct={d.avgConfidencePct}
        />
      </div>

      {/* Row 2: Donut Chart + Rate Tiles with Info Popover */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Risk-distribution Donut */}
        <Panel className="min-w-0 p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="sv-eyebrow">Risk Classification Distribution</p>
              <h2 className="text-sm font-semibold text-[var(--sv-text)]">
                Screening bands (6–59 months)
              </h2>
            </div>
            <span className="font-mono text-xs text-[var(--sv-muted)]">
              n={formatNumber(d.totalScans)}
            </span>
          </div>

          <div className="grid items-center gap-6 md:grid-cols-[1.2fr_1fr]">
            {/* Donut with center total */}
            <div className="relative flex h-[220px] w-full min-w-0 items-center justify-center">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={95}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => [
                      `${formatNumber(v)} (${((v / (d.totalScans || 1)) * 100).toFixed(1)}%)`,
                      "Screenings",
                    ]}
                    contentStyle={{
                      background: "var(--sv-surface)",
                      border: "1px solid var(--sv-border)",
                      borderRadius: "8px",
                      fontSize: "12px",
                      boxShadow: "var(--sv-shadow-md)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span
                  className="font-mono text-2xl font-bold tracking-tight text-[var(--sv-text)]"
                  style={{ fontFamily: "var(--sv-font-mono)" }}
                >
                  {formatNumber(d.totalScans)}
                </span>
                <span className="sv-eyebrow text-[10px]">Total Scans</span>
              </div>
            </div>

            {/* Band Legend & Bars */}
            <div className="space-y-3">
              {[
                {
                  band: "NORMAL" as const,
                  label: "Normal (≥125 mm)",
                  count: d.normalCount,
                  pct: d.shares.normalPct,
                  color: BAND_COLORS.normal,
                },
                {
                  band: "MAM" as const,
                  label: "MAM (115–<125 mm)",
                  count: d.mamCount,
                  pct: d.shares.mamPct,
                  color: BAND_COLORS.mam,
                },
                {
                  band: "SAM" as const,
                  label: "SAM (<115 mm)",
                  count: d.samCount,
                  pct: d.shares.samPct,
                  color: BAND_COLORS.sam,
                },
              ].map(({ band, label, count, pct, color }) => (
                <div key={band} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 font-medium text-[var(--sv-text)]">
                      <span className="size-2 rounded-full" style={{ background: color }} />
                      {label}
                    </span>
                    <span className="font-mono font-semibold" style={{ color: "var(--sv-text)" }}>
                      {formatNumber(count)}{" "}
                      <span className="text-[var(--sv-muted)] font-normal">
                        ({pct.toFixed(1)}%)
                      </span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--sv-border)]">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        {/* GAM and SAM Rate Tiles with WHO Info */}
        <div className="flex flex-col gap-4">
          {/* GAM Rate Card */}
          <Panel className="flex flex-1 flex-col justify-between p-5">
            <div className="flex items-center justify-between">
              <span className="sv-eyebrow">GAM Prevalence</span>
              <button
                type="button"
                onClick={() => setWhoInfoOpen((prev) => !prev)}
                className="flex size-6 items-center justify-center rounded text-[var(--sv-muted)] transition-colors hover:bg-[var(--sv-canvas)] hover:text-[var(--sv-text)]"
                title="WHO screening criteria info"
                aria-label="WHO screening criteria info"
              >
                <Info size={16} />
              </button>
            </div>
            <div>
              <p
                className="font-mono text-3xl font-bold tracking-tight text-[var(--sv-text)]"
                style={{ fontFamily: "var(--sv-font-mono)" }}
              >
                {gamRate.toFixed(1)}%
              </p>
              <p className="mt-1 text-xs text-[var(--sv-muted)]">
                Global Acute Malnutrition (MAM + SAM cases: {formatNumber(gamCount)})
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--sv-muted)]">
              <span
                className="size-2 rounded-full"
                style={{
                  background:
                    gamRate > 15
                      ? "var(--sv-sam)"
                      : gamRate > 10
                        ? "var(--sv-mam)"
                        : "var(--sv-normal)",
                }}
              />
              <span>
                {gamRate > 15
                  ? "WHO Emergency Threshold (>15%)"
                  : gamRate > 10
                    ? "WHO Alert Threshold (10–14.9%)"
                    : "Within expected limits (<10%)"}
              </span>
            </div>
          </Panel>

          {/* SAM Rate Card */}
          <Panel className="flex flex-1 flex-col justify-between p-5">
            <div className="flex items-center justify-between">
              <span className="sv-eyebrow">SAM Prevalence</span>
              <BandBadge band="SAM" size="sm" />
            </div>
            <div>
              <p
                className="font-mono text-3xl font-bold tracking-tight text-[var(--sv-sam)]"
                style={{ fontFamily: "var(--sv-font-mono)" }}
              >
                {samRate.toFixed(1)}%
              </p>
              <p className="mt-1 text-xs text-[var(--sv-muted)]">
                Severe Acute Malnutrition ({formatNumber(d.samCount)} of{" "}
                {formatNumber(d.totalScans)} children)
              </p>
            </div>
            <p className="text-[11px] text-[var(--sv-muted)]">
              Screening aid — immediate facility follow-up required.
            </p>
          </Panel>
        </div>
      </div>

      {/* WHO Criteria Popover / Modal */}
      {whoInfoOpen && (
        <div
          role="dialog"
          aria-label="WHO Screening Bands Explanation"
          className="rounded-lg border border-[var(--sv-border)] bg-[var(--sv-surface)] p-4 text-xs shadow-md space-y-3"
        >
          <div className="flex items-center justify-between border-b border-[var(--sv-border)] pb-2">
            <div className="flex items-center gap-2 font-semibold text-[var(--sv-text)]">
              <Info size={16} weight="duotone" className="text-[var(--sv-primary)]" />
              WHO Child Malnutrition Screening Bands (6–59 months)
            </div>
            <button
              type="button"
              onClick={() => setWhoInfoOpen(false)}
              className="text-[var(--sv-muted)] hover:text-[var(--sv-text)] font-mono text-sm"
            >
              ✕
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded border border-[var(--sv-border)] p-2.5 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-[var(--sv-normal)]">
                <CheckCircle size={14} weight="fill" /> Normal
              </div>
              <p className="font-mono text-[11px] text-[var(--sv-text)]">MUAC ≥ 125 mm</p>
              <p className="text-[11px] text-[var(--sv-muted)]">
                Adequate nutrition status; routine growth monitoring.
              </p>
            </div>
            <div className="rounded border border-[var(--sv-border)] p-2.5 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-[var(--sv-mam)]">
                <Warning size={14} weight="fill" /> MAM
              </div>
              <p className="font-mono text-[11px] text-[var(--sv-text)]">
                115 mm ≤ MUAC &lt; 125 mm
              </p>
              <p className="text-[11px] text-[var(--sv-muted)]">
                Moderate Acute Malnutrition; supplementary feeding support.
              </p>
            </div>
            <div className="rounded border border-[var(--sv-border)] p-2.5 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-[var(--sv-sam)]">
                <WarningOctagon size={14} weight="fill" /> SAM
              </div>
              <p className="font-mono text-[11px] text-[var(--sv-text)]">MUAC &lt; 115 mm</p>
              <p className="text-[11px] text-[var(--sv-muted)]">
                Severe Acute Malnutrition; urgent clinical referral.
              </p>
            </div>
          </div>
          <p className="text-[11px] text-[var(--sv-muted)] italic">
            PoshanScan is a digital screening aid, never a medical diagnosis. Always confirm results
            with a trained frontline healthcare provider.
          </p>
        </div>
      )}

      {/* Row 3: Three Compact Panels */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Panel 1: Needs Attention (Pending Flagged) */}
        <Panel className="flex flex-col justify-between p-5">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FlagBanner size={16} weight="duotone" className="text-[var(--sv-sam)]" />
                <h3 className="text-sm font-semibold text-[var(--sv-text)]">Needs Attention</h3>
              </div>
              <Link
                to="/supervisor/flagged"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--sv-primary)] hover:underline"
              >
                View all <ArrowRight size={12} />
              </Link>
            </div>
            <p className="mb-3 text-xs text-[var(--sv-muted)]">
              Scans flagged for SAM classification or model confidence &lt; 60%
            </p>

            {topPending.length === 0 ? (
              <p className="py-6 text-center text-xs text-[var(--sv-muted)]">
                No pending scans requiring review.
              </p>
            ) : (
              <div className="divide-y divide-[var(--sv-border)]">
                {topPending.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      void navigate({
                        to: `/supervisor/flagged`,
                        search: { scan: item.id } as Record<string, string>,
                      })
                    }
                    className="flex w-full items-center justify-between py-2 text-left transition-colors hover:bg-[var(--sv-canvas)]"
                  >
                    <div>
                      <p className="text-xs font-medium text-[var(--sv-text)]">{item.childName}</p>
                      <p className="text-[11px] text-[var(--sv-muted)]">
                        {item.village} · {item.muacMm} mm
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <BandBadge band={item.band} size="sm" />
                      <span className="font-mono text-[10px] text-[var(--sv-muted)]">
                        {item.confidencePct.toFixed(0)}%
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Panel>

        {/* Panel 2: Highest-Risk Villages */}
        <Panel className="flex flex-col justify-between p-5">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin size={16} weight="duotone" className="text-[var(--sv-mam)]" />
                <h3 className="text-sm font-semibold text-[var(--sv-text)]">
                  Highest-Risk Villages
                </h3>
              </div>
              <Link
                to="/supervisor/locations"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--sv-primary)] hover:underline"
              >
                View all <ArrowRight size={12} />
              </Link>
            </div>
            <p className="mb-3 text-xs text-[var(--sv-muted)]">
              Villages ranked by combined MAM+SAM share (min. volume n≥5)
            </p>

            {topRiskVillages.length === 0 ? (
              <p className="py-6 text-center text-xs text-[var(--sv-muted)]">
                No village data meeting the volume threshold.
              </p>
            ) : (
              <div className="divide-y divide-[var(--sv-border)]">
                {topRiskVillages.map((loc) => (
                  <div key={loc.name} className="flex items-center justify-between py-2 text-xs">
                    <div>
                      <p className="font-medium text-[var(--sv-text)]">{loc.name}</p>
                      <p className="text-[11px] text-[var(--sv-muted)]">
                        {loc.block ? `${loc.block} · ` : ""}n={loc.totalScans}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-semibold text-[var(--sv-sam)]">
                        {loc.gamRate}% GAM
                      </span>
                      <p className="text-[10px] text-[var(--sv-muted)] font-mono">
                        {loc.samCount} SAM
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Panel>

        {/* Panel 3: Most Active Workers */}
        <Panel className="flex flex-col justify-between p-5">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UsersThree size={16} weight="duotone" className="text-[var(--sv-primary)]" />
                <h3 className="text-sm font-semibold text-[var(--sv-text)]">Most Active Workers</h3>
              </div>
              <Link
                to="/supervisor/workers"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--sv-primary)] hover:underline"
              >
                View all <ArrowRight size={12} />
              </Link>
            </div>
            <p className="mb-3 text-xs text-[var(--sv-muted)]">
              Top frontline team members by total screening count
            </p>

            {topWorkers.length === 0 ? (
              <p className="py-6 text-center text-xs text-[var(--sv-muted)]">
                No active workers reported.
              </p>
            ) : (
              <div className="divide-y divide-[var(--sv-border)]">
                {topWorkers.map((w) => (
                  <div key={w.id} className="flex items-center justify-between py-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                        style={{ background: "var(--sv-primary)" }}
                      >
                        {w.initials}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-[var(--sv-text)]">{w.name}</p>
                        <p className="text-[10px] text-[var(--sv-muted)] truncate">
                          {w.assignedVillages.length > 0 ? w.assignedVillages.join(", ") : w.phone}
                        </p>
                      </div>
                    </div>
                    <div className="text-right font-mono shrink-0">
                      <span className="font-semibold text-[var(--sv-text)]">
                        {formatNumber(w.totalScans)}
                      </span>
                      <p className="text-[10px] text-[var(--sv-muted)]">scans</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
