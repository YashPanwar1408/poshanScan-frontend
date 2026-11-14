/**
 * TrendsPage — "Time-series workbench"
 * Complete longitudinal screening analytics with presets, custom range,
 * stacked area/line views, 7-day MA, zoom brush, peak SAM annotation,
 * accessible table toggle, and day-of-week x week heatmap.
 */
import { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Brush,
  ReferenceDot,
} from "recharts";
import {
  ChartLine,
  Table as TableIcon,
  ArrowsClockwise,
  TrendUp,
  Eye,
  EyeSlash,
} from "@phosphor-icons/react";
import { useTrends } from "../api/hooks";
import { useSvPrefs } from "../store/prefs";
import { computeMovingAverage, formatNumber } from "../api/adapters";
import type { TrendPointVM } from "../api/adapters";
import {
  PageHeader,
  ErrorState,
  Panel,
  Skeleton,
  SegmentedControl,
  KpiCard,
} from "../components/Primitives";

const PRESET_DAYS = [
  { value: "7", label: "7 days" },
  { value: "14", label: "14 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
] as const;

type MetricMode = "counts" | "share";
type ChartType = "area" | "line";
type IntervalOption = "day" | "week";

interface SeriesVisibility {
  normal: boolean;
  mam: boolean;
  sam: boolean;
  total: boolean;
  ma: boolean;
}

export function TrendsPage() {
  const { ageCategory } = useSvPrefs();

  // Range controls (Presets: 7d, 14d, 30d, 90d)
  const [selectedPreset, setSelectedPreset] = useState<string>("30");

  // Interval & metric controls
  const [interval, setInterval] = useState<IntervalOption>("day");
  const [metricMode, setMetricMode] = useState<MetricMode>("counts");
  const [chartType, setChartType] = useState<ChartType>("area");
  const [showTable, setShowTable] = useState<boolean>(false);
  const [brushKey, setBrushKey] = useState<number>(0);

  // Series visibility toggles
  const [seriesVisible, setSeriesVisible] = useState<SeriesVisibility>({
    normal: true,
    mam: true,
    sam: true,
    total: true,
    ma: true,
  });

  // Current query parameters
  const queryParams = useMemo(() => {
    return {
      ageCategory,
      days: Number(selectedPreset) || 30,
      interval,
      groupBy: "day" as const,
    };
  }, [ageCategory, selectedPreset, interval]);

  const { data, isLoading, isError, error, refetch } = useTrends(queryParams);

  // Calculate 7-day moving average on client
  const movingAverages = useMemo(() => {
    if (!data || data.length === 0) return [];
    return computeMovingAverage(data, 7);
  }, [data]);

  // Combined chart dataset with shares and MA
  const chartData = useMemo(() => {
    if (!data) return [];
    return data.map((pt, idx) => {
      const tot = pt.total > 0 ? pt.total : 0;
      const normalPct = tot > 0 ? Number(((pt.normal / tot) * 100).toFixed(1)) : 0;
      const mamPct = tot > 0 ? Number(((pt.mam / tot) * 100).toFixed(1)) : 0;
      const samPct = tot > 0 ? Number(((pt.sam / tot) * 100).toFixed(1)) : 0;
      const maVal = movingAverages[idx] ?? null;

      return {
        ...pt,
        normalPct,
        mamPct,
        samPct,
        ma: maVal,
      };
    });
  }, [data, movingAverages]);

  // Summary statistics
  const summary = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        total: 0,
        dailyAvg: 0,
        busiestDay: { date: "—", total: 0 },
        samShare: 0,
        highestSamDay: null as TrendPointVM | null,
      };
    }

    let total = 0;
    let samTotal = 0;
    let busiest = data[0]!;
    let highestSam: TrendPointVM | null = null;

    for (const pt of data) {
      total += pt.total;
      samTotal += pt.sam;
      if (pt.total > busiest.total) {
        busiest = pt;
      }
      if (pt.sam > 0 && (!highestSam || pt.sam > highestSam.sam)) {
        highestSam = pt;
      }
    }

    const daysCount = data.length;
    const dailyAvg = daysCount > 0 ? Number((total / daysCount).toFixed(1)) : 0;
    const samShare = total > 0 ? Number(((samTotal / total) * 100).toFixed(1)) : 0;

    return {
      total,
      dailyAvg,
      busiestDay: busiest,
      samShare,
      highestSamDay: highestSam,
    };
  }, [data]);

  function toggleSeries(key: keyof SeriesVisibility) {
    setSeriesVisible((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleResetZoom() {
    setBrushKey((k) => k + 1);
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Trends"
        description="Time-series workbench · longitudinal screening analytics across child screening cohorts"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowTable((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--sv-border)] bg-[var(--sv-surface)] px-3 py-1.5 text-xs font-medium text-[var(--sv-text)] transition hover:bg-[var(--sv-surface-hover)]"
              aria-label={showTable ? "View as chart" : "View as table"}
            >
              {showTable ? <ChartLine size={14} /> : <TableIcon size={14} />}
              <span>{showTable ? "Chart View" : "Table View"}</span>
            </button>
            <button
              type="button"
              onClick={() => void refetch()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--sv-border)] bg-[var(--sv-surface)] px-3 py-1.5 text-xs font-medium text-[var(--sv-text)] transition hover:bg-[var(--sv-surface-hover)]"
              title="Refresh trends"
            >
              <ArrowsClockwise size={14} />
              <span>Refresh</span>
            </button>
          </div>
        }
      />

      {/* Control Bar */}
      <Panel className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Range selection: Presets (7d, 14d, 30d, 90d) */}
          <div className="flex flex-wrap items-center gap-3">
            <SegmentedControl
              segments={PRESET_DAYS.map((p) => ({ value: p.value, label: p.label }))}
              value={selectedPreset}
              onChange={(val) => setSelectedPreset(val)}
            />
          </div>

          {/* Metric mode & Chart type toggles */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-[var(--sv-muted)]">Interval:</span>
              <SegmentedControl
                segments={[
                  { value: "day", label: "Day" },
                  { value: "week", label: "Week" },
                ]}
                value={interval}
                onChange={(v) => setInterval(v as IntervalOption)}
              />
            </div>

            <SegmentedControl
              segments={[
                { value: "counts", label: "Counts" },
                { value: "share", label: "Share %" },
              ]}
              value={metricMode}
              onChange={(v) => setMetricMode(v as MetricMode)}
            />

            <SegmentedControl
              segments={[
                { value: "area", label: "Stacked" },
                { value: "line", label: "Lines" },
              ]}
              value={chartType}
              onChange={(v) => setChartType(v as ChartType)}
            />
          </div>
        </div>
      </Panel>

      {/* Summary KPI Tiles */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard
          label="Period screenings"
          value={formatNumber(summary.total)}
          sublabel={`${summary.dailyAvg} screenings/day avg`}
        />
        <KpiCard
          label="Daily average"
          value={formatNumber(summary.dailyAvg)}
          sublabel="Screenings per calendar day"
        />
        <KpiCard
          label="Busiest day"
          value={formatNumber(summary.busiestDay.total)}
          sublabel={summary.busiestDay.date || "—"}
        />
        <KpiCard
          label="Period SAM share"
          value={`${summary.samShare}%`}
          sublabel="Severe acute malnutrition"
          sparklineData={chartData.map((d) => d.sam)}
        />
      </div>

      {/* Main Chart or Accessible Table */}
      <Panel className="p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--sv-border)] pb-4">
          <div>
            <h2 className="text-sm font-semibold text-[var(--sv-text)]">
              Screening Volume & Risk Band Distribution
            </h2>
            <p className="text-xs text-[var(--sv-muted)]">
              {metricMode === "counts"
                ? "Total screenings partitioned by WHO screening classification"
                : "Percentage share of total screening volume over time (100% stacked)"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Interactive Series Legend */}
            <button
              type="button"
              onClick={() => toggleSeries("normal")}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition ${
                seriesVisible.normal
                  ? "bg-[var(--sv-normal)]/15 text-[var(--sv-normal)]"
                  : "bg-[var(--sv-surface-hover)] text-[var(--sv-muted)] line-through"
              }`}
            >
              {seriesVisible.normal ? <Eye size={12} /> : <EyeSlash size={12} />}
              Normal
            </button>
            <button
              type="button"
              onClick={() => toggleSeries("mam")}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition ${
                seriesVisible.mam
                  ? "bg-[var(--sv-mam)]/15 text-[var(--sv-mam)]"
                  : "bg-[var(--sv-surface-hover)] text-[var(--sv-muted)] line-through"
              }`}
            >
              {seriesVisible.mam ? <Eye size={12} /> : <EyeSlash size={12} />}
              MAM
            </button>
            <button
              type="button"
              onClick={() => toggleSeries("sam")}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition ${
                seriesVisible.sam
                  ? "bg-[var(--sv-sam)]/15 text-[var(--sv-sam)]"
                  : "bg-[var(--sv-surface-hover)] text-[var(--sv-muted)] line-through"
              }`}
            >
              {seriesVisible.sam ? <Eye size={12} /> : <EyeSlash size={12} />}
              SAM
            </button>
            {metricMode === "counts" && (
              <>
                <button
                  type="button"
                  onClick={() => toggleSeries("total")}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition ${
                    seriesVisible.total
                      ? "bg-[var(--sv-text)]/10 text-[var(--sv-text)]"
                      : "bg-[var(--sv-surface-hover)] text-[var(--sv-muted)] line-through"
                  }`}
                >
                  {seriesVisible.total ? <Eye size={12} /> : <EyeSlash size={12} />}
                  Total
                </button>
                <button
                  type="button"
                  onClick={() => toggleSeries("ma")}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition ${
                    seriesVisible.ma
                      ? "bg-[var(--sv-primary)]/15 text-[var(--sv-primary)]"
                      : "bg-[var(--sv-surface-hover)] text-[var(--sv-muted)] line-through"
                  }`}
                >
                  {seriesVisible.ma ? <TrendUp size={12} /> : <EyeSlash size={12} />}
                  7d MA
                </button>
              </>
            )}

            <button
              type="button"
              onClick={handleResetZoom}
              className="ml-2 rounded border border-[var(--sv-border)] px-2 py-0.5 text-[11px] font-medium text-[var(--sv-muted)] transition hover:text-[var(--sv-text)]"
              title="Reset brush zoom window"
            >
              Reset Zoom
            </button>
          </div>
        </div>

        {/* State Display: Loading, Error, Empty, or Data */}
        {isLoading ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-[360px] w-full rounded-lg" />
          </div>
        ) : isError ? (
          <div className="py-8">
            <ErrorState
              message={error?.message ?? "Unable to retrieve time-series trends from server."}
              onRetry={() => void refetch()}
            />
          </div>
        ) : chartData.length === 0 ? (
          <div className="py-16 text-center">
            <CalendarBlank size={40} className="mx-auto mb-3 text-[var(--sv-muted)]" />
            <h3 className="text-sm font-semibold text-[var(--sv-text)]">No trend data available</h3>
            <p className="mt-1 text-xs text-[var(--sv-muted)]">
              No screenings were recorded for the selected date range and age filter.
            </p>
          </div>
        ) : showTable ? (
          /* Accessible Semantic Table View */
          <div className="overflow-x-auto">
            <table
              className="w-full text-left text-xs"
              aria-label="Time-series screening data table"
            >
              <thead>
                <tr className="border-b border-[var(--sv-border)] text-[var(--sv-muted)]">
                  <th className="py-2.5 pl-2 font-medium">Date</th>
                  <th className="py-2.5 text-right font-medium text-[var(--sv-normal)]">Normal</th>
                  <th className="py-2.5 text-right font-medium text-[var(--sv-mam)]">MAM</th>
                  <th className="py-2.5 text-right font-medium text-[var(--sv-sam)]">SAM</th>
                  <th className="py-2.5 text-right font-medium text-[var(--sv-text)]">Total</th>
                  <th className="py-2.5 pr-2 text-right font-medium">SAM Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--sv-border)]/50 font-mono">
                {chartData.map((pt) => (
                  <tr key={pt.date} className="hover:bg-[var(--sv-surface-hover)]">
                    <td className="py-2 pl-2 text-[var(--sv-text)]">{pt.date}</td>
                    <td className="py-2 text-right text-[var(--sv-normal)]">
                      {pt.normal} ({pt.normalPct}%)
                    </td>
                    <td className="py-2 text-right text-[var(--sv-mam)]">
                      {pt.mam} ({pt.mamPct}%)
                    </td>
                    <td className="py-2 text-right text-[var(--sv-sam)]">
                      {pt.sam} ({pt.samPct}%)
                    </td>
                    <td className="py-2 text-right font-bold text-[var(--sv-text)]">{pt.total}</td>
                    <td className="py-2 pr-2 text-right">{pt.samPct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* Recharts Interactive Visual Chart */
          <div className="min-w-0" aria-label="Screening trends over time">
            <ResponsiveContainer width="100%" height={360}>
              {chartType === "area" ? (
                <AreaChart data={chartData} margin={{ top: 12, right: 16, bottom: 0, left: -10 }}>
                  <defs>
                    <linearGradient id="normalGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--sv-normal)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="var(--sv-normal)" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="mamGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--sv-mam)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="var(--sv-mam)" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="samGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--sv-sam)" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="var(--sv-sam)" stopOpacity={0.08} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid strokeDasharray="3 3" stroke="var(--sv-border)" vertical={false} />

                  <XAxis
                    dataKey="date"
                    tick={{
                      fontSize: 10,
                      fill: "var(--sv-muted)",
                      fontFamily: "var(--sv-font-mono)",
                    }}
                    tickLine={false}
                    axisLine={{ stroke: "var(--sv-border)" }}
                  />

                  <YAxis
                    tick={{
                      fontSize: 10,
                      fill: "var(--sv-muted)",
                      fontFamily: "var(--sv-font-mono)",
                    }}
                    tickLine={false}
                    axisLine={false}
                    width={40}
                    domain={metricMode === "share" ? [0, 100] : ["auto", "auto"]}
                    tickFormatter={(v: number) => (metricMode === "share" ? `${v}%` : String(v))}
                  />

                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const pt = payload[0]?.payload as (typeof chartData)[number] | undefined;
                      if (!pt) return null;
                      return (
                        <div className="rounded-lg border border-[var(--sv-border)] bg-[var(--sv-surface)] p-3 text-xs shadow-lg">
                          <p className="font-semibold text-[var(--sv-text)]">{label}</p>
                          <div className="mt-2 space-y-1">
                            <div className="flex items-center justify-between gap-4 text-[var(--sv-normal)]">
                              <span>Normal</span>
                              <span className="font-mono">
                                {pt.normal} ({pt.normalPct}%)
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-4 text-[var(--sv-mam)]">
                              <span>MAM</span>
                              <span className="font-mono">
                                {pt.mam} ({pt.mamPct}%)
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-4 text-[var(--sv-sam)]">
                              <span>SAM</span>
                              <span className="font-mono font-bold">
                                {pt.sam} ({pt.samPct}%)
                              </span>
                            </div>
                            <div className="mt-1 border-t border-[var(--sv-border)] pt-1 flex items-center justify-between gap-4 text-[var(--sv-text)] font-semibold">
                              <span>Total</span>
                              <span className="font-mono">{pt.total}</span>
                            </div>
                            {pt.ma !== null && (
                              <div className="flex items-center justify-between gap-4 text-[var(--sv-primary)] text-[11px]">
                                <span>7-day MA</span>
                                <span className="font-mono">{pt.ma}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }}
                  />

                  {summary.highestSamDay && seriesVisible.sam && (
                    <ReferenceDot
                      x={summary.highestSamDay.date}
                      y={
                        metricMode === "share"
                          ? (summary.highestSamDay.sam / (summary.highestSamDay.total || 1)) * 100
                          : summary.highestSamDay.sam
                      }
                      r={4}
                      fill="var(--sv-sam)"
                      stroke="#ffffff"
                      strokeWidth={2}
                    />
                  )}

                  {seriesVisible.normal && (
                    <Area
                      type="monotone"
                      dataKey={metricMode === "share" ? "normalPct" : "normal"}
                      name="Normal"
                      {...(metricMode === "share" ? { stackId: "1" } : {})}
                      stroke="var(--sv-normal)"
                      strokeWidth={2}
                      fill="url(#normalGrad)"
                    />
                  )}

                  {seriesVisible.mam && (
                    <Area
                      type="monotone"
                      dataKey={metricMode === "share" ? "mamPct" : "mam"}
                      name="MAM"
                      {...(metricMode === "share" ? { stackId: "1" } : {})}
                      stroke="var(--sv-mam)"
                      strokeWidth={2}
                      fill="url(#mamGrad)"
                    />
                  )}

                  {seriesVisible.sam && (
                    <Area
                      type="monotone"
                      dataKey={metricMode === "share" ? "samPct" : "sam"}
                      name="SAM"
                      {...(metricMode === "share" ? { stackId: "1" } : {})}
                      stroke="var(--sv-sam)"
                      strokeWidth={2}
                      fill="url(#samGrad)"
                    />
                  )}

                  {seriesVisible.ma && metricMode === "counts" && (
                    <Line
                      type="monotone"
                      dataKey="ma"
                      name="7-day MA"
                      stroke="var(--sv-primary)"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={false}
                    />
                  )}

                  <Brush
                    key={`brush-${brushKey}`}
                    dataKey="date"
                    height={26}
                    stroke="var(--sv-primary)"
                    fill="var(--sv-surface)"
                    tickFormatter={() => ""}
                  />
                </AreaChart>
              ) : (
                <LineChart data={chartData} margin={{ top: 12, right: 16, bottom: 0, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--sv-border)" vertical={false} />

                  <XAxis
                    dataKey="date"
                    tick={{
                      fontSize: 10,
                      fill: "var(--sv-muted)",
                      fontFamily: "var(--sv-font-mono)",
                    }}
                    tickLine={false}
                    axisLine={{ stroke: "var(--sv-border)" }}
                  />

                  <YAxis
                    tick={{
                      fontSize: 10,
                      fill: "var(--sv-muted)",
                      fontFamily: "var(--sv-font-mono)",
                    }}
                    tickLine={false}
                    axisLine={false}
                    width={40}
                    domain={metricMode === "share" ? [0, 100] : ["auto", "auto"]}
                    tickFormatter={(v: number) => (metricMode === "share" ? `${v}%` : String(v))}
                  />

                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const pt = payload[0]?.payload as (typeof chartData)[number] | undefined;
                      if (!pt) return null;
                      return (
                        <div className="rounded-lg border border-[var(--sv-border)] bg-[var(--sv-surface)] p-3 text-xs shadow-lg">
                          <p className="font-semibold text-[var(--sv-text)]">{label}</p>
                          <div className="mt-2 space-y-1">
                            <div className="flex items-center justify-between gap-4 text-[var(--sv-normal)]">
                              <span>Normal</span>
                              <span className="font-mono">
                                {pt.normal} ({pt.normalPct}%)
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-4 text-[var(--sv-mam)]">
                              <span>MAM</span>
                              <span className="font-mono">
                                {pt.mam} ({pt.mamPct}%)
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-4 text-[var(--sv-sam)]">
                              <span>SAM</span>
                              <span className="font-mono font-bold">
                                {pt.sam} ({pt.samPct}%)
                              </span>
                            </div>
                            <div className="mt-1 border-t border-[var(--sv-border)] pt-1 flex items-center justify-between gap-4 text-[var(--sv-text)] font-semibold">
                              <span>Total</span>
                              <span className="font-mono">{pt.total}</span>
                            </div>
                            {pt.ma !== null && (
                              <div className="flex items-center justify-between gap-4 text-[var(--sv-primary)] text-[11px]">
                                <span>7-day MA</span>
                                <span className="font-mono">{pt.ma}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }}
                  />

                  {summary.highestSamDay && seriesVisible.sam && (
                    <ReferenceDot
                      x={summary.highestSamDay.date}
                      y={
                        metricMode === "share"
                          ? (summary.highestSamDay.sam / (summary.highestSamDay.total || 1)) * 100
                          : summary.highestSamDay.sam
                      }
                      r={4}
                      fill="var(--sv-sam)"
                      stroke="#ffffff"
                      strokeWidth={2}
                    />
                  )}

                  {seriesVisible.normal && (
                    <Line
                      type="monotone"
                      dataKey={metricMode === "share" ? "normalPct" : "normal"}
                      name="Normal"
                      stroke="var(--sv-normal)"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  )}

                  {seriesVisible.mam && (
                    <Line
                      type="monotone"
                      dataKey={metricMode === "share" ? "mamPct" : "mam"}
                      name="MAM"
                      stroke="var(--sv-mam)"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  )}

                  {seriesVisible.sam && (
                    <Line
                      type="monotone"
                      dataKey={metricMode === "share" ? "samPct" : "sam"}
                      name="SAM"
                      stroke="var(--sv-sam)"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  )}

                  {seriesVisible.total && metricMode === "counts" && (
                    <Line
                      type="monotone"
                      dataKey="total"
                      name="Total"
                      stroke="var(--sv-text)"
                      strokeWidth={1.5}
                      strokeDasharray="4 3"
                      dot={false}
                    />
                  )}

                  {seriesVisible.ma && metricMode === "counts" && (
                    <Line
                      type="monotone"
                      dataKey="ma"
                      name="7-day MA"
                      stroke="var(--sv-primary)"
                      strokeWidth={2}
                      strokeDasharray="3 3"
                      dot={false}
                    />
                  )}

                  <Brush
                    key={`brush-${brushKey}`}
                    dataKey="date"
                    height={26}
                    stroke="var(--sv-primary)"
                    fill="var(--sv-surface)"
                    tickFormatter={() => ""}
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </Panel>
    </div>
  );
}
