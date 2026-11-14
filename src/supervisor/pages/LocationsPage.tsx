/**
 * LocationsPage — "Risk map"
 * Geographic surveillance map powered by react-leaflet and CartoDB Positron/Dark Matter basemaps.
 * Features bubble & heatmap modes, SAM/GAM/Volume scaling, client-side grouping,
 * hover/click marker-list bidirectional sync, and detail card with covering workers.
 */
import { useState, useMemo, useRef, useEffect } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import {
  MapTrifold,
  MagnifyingGlass,
  ArrowClockwise,
  Warning,
  User,
  Users,
  ShieldCheck,
  Funnel,
  Check,
  Info,
} from "@phosphor-icons/react";
import { useLocations, useWorkers } from "../api/hooks";
import { useSvPrefs } from "../store/prefs";
import { aggregateLocations, formatNumber } from "../api/adapters";
import type { LocationVM } from "../api/adapters";
import {
  PageHeader,
  ErrorState,
  EmptyState,
  Panel,
  Skeleton,
  SegmentedControl,
} from "../components/Primitives";

type ViewMode = "bubbles" | "heat";
type MetricKey = "samRate" | "gamRate" | "volume";
type GroupByKey = "village" | "block" | "district";
type SortOption = "risk_desc" | "volume_desc" | "name_asc";

// Controller component to safely manage Leaflet map bounds, flyTo, and resize invalidation
function MapController({
  selectedCoords,
  points,
  resetTrigger,
}: {
  selectedCoords: [number, number] | null;
  points: { lat: number; lng: number }[];
  resetTrigger: number;
}) {
  const map = useMap();
  const initialFitDone = useRef(false);

  // ResizeObserver to handle container layout changes
  useEffect(() => {
    const container = map.getContainer();
    if (!container) return;
    const ro = new ResizeObserver(() => {
      map.invalidateSize();
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [map]);

  // Fit bounds on first load or manual reset
  useEffect(() => {
    if (points.length === 0) return;
    if (!initialFitDone.current || resetTrigger > 0) {
      initialFitDone.current = true;
      if (points.length === 1) {
        const pt = points[0]!;
        map.setView([pt.lat, pt.lng], 13);
      } else {
        const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      }
    }
  }, [map, points, resetTrigger]);

  // Fly to clicked location
  useEffect(() => {
    if (selectedCoords) {
      map.flyTo(selectedCoords, 13, { duration: 0.8 });
    }
  }, [map, selectedCoords]);

  return null;
}

// Leaflet heatmap layer wrapper with clean unmount
function HeatmapLayer({ points }: { points: [number, number, number][] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;
    const maxIntensity = Math.max(...points.map(([, , intensity]) => intensity), 1);
    const heat = L.layerGroup(
      points.map(([lat, lng, intensity]) => {
        const ratio = intensity / maxIntensity;
        const color = ratio >= 0.8 ? "#ef4444" : ratio >= 0.5 ? "#eab308" : "#3b82f6";
        return L.circleMarker([lat, lng], {
          radius: 18 + ratio * 14,
          color,
          fillColor: color,
          fillOpacity: 0.2 + ratio * 0.35,
          weight: 1,
        });
      }),
    ).addTo(map);

    return () => {
      map.removeLayer(heat);
    };
  }, [map, points]);

  return null;
}

export function LocationsPage() {
  const { ageCategory, theme } = useSvPrefs();
  const { data: rawLocations, isLoading, isError, error, refetch } = useLocations(ageCategory);
  const { data: workersData } = useWorkers(ageCategory);

  // UI state
  const [viewMode, setViewMode] = useState<ViewMode>("bubbles");
  const [metric, setMetric] = useState<MetricKey>("samRate");
  const [groupBy, setGroupBy] = useState<GroupByKey>("village");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("risk_desc");
  const [selectedLocation, setSelectedLocation] = useState<LocationVM | null>(null);
  const [hoveredLocationName, setHoveredLocationName] = useState<string | null>(null);
  const [tileError, setTileError] = useState(false);
  const [resetTrigger, setResetTrigger] = useState(0);

  // Dark vs Light basemap URL
  const isDark = theme === "dark";

  const tileUrl = isDark
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

  // Aggregate locations based on grouping selection
  const aggregated = useMemo(() => {
    if (!rawLocations) return [];
    return aggregateLocations(rawLocations, groupBy);
  }, [rawLocations, groupBy]);

  // Valid coordinates check
  const { withCoords, withoutCoordsCount } = useMemo(() => {
    const valid: LocationVM[] = [];
    let invalidCount = 0;
    for (const loc of aggregated) {
      if (
        loc.lat != null &&
        loc.lng != null &&
        !Number.isNaN(loc.lat) &&
        !Number.isNaN(loc.lng) &&
        loc.lat !== 0 &&
        loc.lng !== 0
      ) {
        valid.push(loc);
      } else {
        invalidCount++;
      }
    }
    return { withCoords: valid, withoutCoordsCount: invalidCount };
  }, [aggregated]);

  // Filtered and sorted village list
  const filteredList = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = aggregated;

    if (q) {
      list = list.filter(
        (loc) =>
          loc.name.toLowerCase().includes(q) ||
          (loc.block && loc.block.toLowerCase().includes(q)) ||
          (loc.district && loc.district.toLowerCase().includes(q)),
      );
    }

    return [...list].sort((a, b) => {
      if (sortBy === "risk_desc") return b.samRate - a.samRate;
      if (sortBy === "volume_desc") return b.totalScans - a.totalScans;
      return a.name.localeCompare(b.name);
    });
  }, [aggregated, search, sortBy]);

  // Max volume for normalization
  const maxVolume = useMemo(() => {
    let m = 1;
    for (const loc of withCoords) {
      if (loc.totalScans > m) m = loc.totalScans;
    }
    return m;
  }, [withCoords]);

  // Heatmap dataset
  const heatPoints = useMemo<[number, number, number][]>(() => {
    return withCoords.map((loc) => {
      let weight = 0.5;
      if (metric === "samRate") {
        weight = Math.min(1.0, Math.max(0.1, loc.samRate / 20));
      } else if (metric === "gamRate") {
        weight = Math.min(1.0, Math.max(0.1, loc.gamRate / 30));
      } else {
        weight = Math.min(1.0, Math.max(0.1, loc.totalScans / maxVolume));
      }
      return [loc.lat!, loc.lng!, weight];
    });
  }, [withCoords, metric, maxVolume]);

  // Workers covering selected village
  const coveringWorkers = useMemo(() => {
    if (!selectedLocation || !workersData) return [];
    const target = selectedLocation.name.trim().toLowerCase();
    return workersData.filter((w) =>
      w.assignedVillages.some((v) => v.trim().toLowerCase() === target),
    );
  }, [selectedLocation, workersData]);

  // Color & radius calculation for bubbles
  function getMarkerStyle(loc: LocationVM) {
    const isHovered = hoveredLocationName === loc.name;
    const isSelected = selectedLocation?.name === loc.name;

    // Radius scaled by sqrt(volume)
    const baseRadius = Math.max(7, Math.min(26, Math.sqrt(loc.totalScans || 1) * 3.8));
    const radius = isSelected ? baseRadius + 4 : isHovered ? baseRadius + 2 : baseRadius;

    let color = "var(--sv-normal)";
    if (metric === "samRate") {
      if (loc.samRate >= 10) color = "var(--sv-sam)";
      else if (loc.samRate >= 5) color = "var(--sv-mam)";
      else color = "var(--sv-normal)";
    } else if (metric === "gamRate") {
      if (loc.gamRate >= 15) color = "var(--sv-sam)";
      else if (loc.gamRate >= 10) color = "var(--sv-mam)";
      else color = "var(--sv-normal)";
    } else {
      color = "var(--sv-primary)";
    }

    const isLowSample = loc.totalScans < 5;

    return {
      radius,
      color: isSelected ? "#ffffff" : color,
      fillColor: color,
      fillOpacity: isLowSample ? 0.2 : isSelected ? 0.9 : 0.65,
      weight: isSelected ? 3 : isLowSample ? 1.5 : 2,
      dashArray: isLowSample ? "3 3" : undefined,
    };
  }

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <PageHeader
        title="Locations"
        description="Geographic surveillance · Village risk mapping & field worker coverage"
        actions={
          <button
            type="button"
            onClick={() => setResetTrigger((k) => k + 1)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--sv-border)] bg-[var(--sv-surface)] px-3 py-1.5 text-xs font-medium text-[var(--sv-text)] transition hover:bg-[var(--sv-surface-hover)]"
            title="Reset map view to encompass all coordinates"
          >
            <MapTrifold size={14} />
            <span>Reset Map View</span>
          </button>
        }
      />

      {/* Control Bar: Mode, Metric, Grouping */}
      <Panel className="p-3">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Map Modes & Metric */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-[var(--sv-muted)]">Mode:</span>
              <SegmentedControl
                segments={[
                  { value: "bubbles", label: "Bubbles" },
                  { value: "heat", label: "Heatmap" },
                ]}
                value={viewMode}
                onChange={(v) => setViewMode(v as ViewMode)}
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="font-medium text-[var(--sv-muted)]">Metric:</span>
              <SegmentedControl
                segments={[
                  { value: "samRate", label: "SAM Rate" },
                  { value: "gamRate", label: "GAM Rate" },
                  { value: "volume", label: "Volume" },
                ]}
                value={metric}
                onChange={(v) => setMetric(v as MetricKey)}
              />
            </div>
          </div>

          {/* Grouping */}
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-[var(--sv-muted)]">Group by:</span>
            <SegmentedControl
              segments={[
                { value: "village", label: "Village" },
                { value: "block", label: "Block" },
                { value: "district", label: "District" },
              ]}
              value={groupBy}
              onChange={(v) => {
                setGroupBy(v as GroupByKey);
                setSelectedLocation(null);
              }}
            />
          </div>
        </div>
      </Panel>

      {/* Main Split Layout: Map (65%) + Village List & Detail (35%) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 min-w-0">
        {/* Map Panel (~65% = 8 cols) */}
        <div className="relative flex flex-col rounded-xl border border-[var(--sv-border)] bg-[var(--sv-surface)] overflow-hidden lg:col-span-8 h-[520px] lg:h-[calc(100vh-210px)] min-h-[480px]">
          {/* Offline Tile Error Banner */}
          {tileError && (
            <div className="absolute top-2 left-2 right-2 z-[1000] flex items-center justify-between rounded-lg border border-[var(--sv-mam)]/30 bg-[var(--sv-surface)]/95 px-3 py-1.5 text-xs text-[var(--sv-mam)] shadow-md backdrop-blur">
              <div className="flex items-center gap-2">
                <Warning size={14} />
                <span>Basemap tiles unavailable offline — location markers still active</span>
              </div>
              <button
                type="button"
                onClick={() => setTileError(false)}
                className="text-[11px] font-semibold underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Missing coordinates notice */}
          {withoutCoordsCount > 0 && (
            <div className="absolute bottom-3 left-3 z-[1000] rounded-md border border-[var(--sv-border)] bg-[var(--sv-surface)]/90 px-2.5 py-1 text-[11px] text-[var(--sv-muted)] shadow backdrop-blur">
              {withoutCoordsCount} {withoutCoordsCount === 1 ? "location lacks" : "locations lack"}{" "}
              GPS coordinates
            </div>
          )}

          {/* Map Legend Overlay */}
          <div className="absolute top-3 right-3 z-[1000] rounded-lg border border-[var(--sv-border)] bg-[var(--sv-surface)]/90 p-2 text-[11px] shadow-md backdrop-blur">
            <p className="font-semibold text-[var(--sv-text)] mb-1">
              {metric === "samRate"
                ? "SAM Prevalence"
                : metric === "gamRate"
                  ? "GAM Prevalence"
                  : "Volume Scale"}
            </p>
            {metric === "samRate" ? (
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-[var(--sv-normal)]">
                  <span className="size-2.5 rounded-full bg-[var(--sv-normal)]" />
                  <span>&lt; 5% (Low risk)</span>
                </div>
                <div className="flex items-center gap-1.5 text-[var(--sv-mam)]">
                  <span className="size-2.5 rounded-full bg-[var(--sv-mam)]" />
                  <span>5% – 10% (Alert)</span>
                </div>
                <div className="flex items-center gap-1.5 text-[var(--sv-sam)]">
                  <span className="size-2.5 rounded-full bg-[var(--sv-sam)]" />
                  <span>&ge; 10% (Critical)</span>
                </div>
                <div className="flex items-center gap-1.5 text-[var(--sv-muted)] pt-0.5 border-t border-[var(--sv-border)]">
                  <span className="size-2.5 rounded-full border border-dashed border-[var(--sv-muted)]" />
                  <span>Hollow: Low sample (n &lt; 5)</span>
                </div>
              </div>
            ) : metric === "gamRate" ? (
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-[var(--sv-normal)]">
                  <span className="size-2.5 rounded-full bg-[var(--sv-normal)]" />
                  <span>&lt; 10% (Acceptable)</span>
                </div>
                <div className="flex items-center gap-1.5 text-[var(--sv-mam)]">
                  <span className="size-2.5 rounded-full bg-[var(--sv-mam)]" />
                  <span>10% – 15% (Poor)</span>
                </div>
                <div className="flex items-center gap-1.5 text-[var(--sv-sam)]">
                  <span className="size-2.5 rounded-full bg-[var(--sv-sam)]" />
                  <span>&ge; 15% (Critical)</span>
                </div>
              </div>
            ) : (
              <div className="text-[var(--sv-muted)] space-y-0.5">
                <p>Circle radius scales with screening volume</p>
              </div>
            )}
          </div>

          {/* Map Loading / Error / Empty / Render */}
          {isLoading ? (
            <div className="flex h-full w-full items-center justify-center">
              <Skeleton className="h-full w-full" />
            </div>
          ) : isError ? (
            <div className="flex h-full w-full items-center justify-center p-6">
              <ErrorState
                message={error?.message ?? "Failed to load location coordinates."}
                onRetry={() => void refetch()}
              />
            </div>
          ) : (
            <MapContainer
              center={[20.5937, 78.9629]} // Default to India centroid
              zoom={5}
              style={{ height: "100%", width: "100%", background: "var(--sv-canvas)" }}
              scrollWheelZoom={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                url={tileUrl}
                eventHandlers={{
                  tileerror: () => setTileError(true),
                }}
              />

              <MapController
                selectedCoords={
                  selectedLocation && selectedLocation.lat != null && selectedLocation.lng != null
                    ? [selectedLocation.lat, selectedLocation.lng]
                    : null
                }
                points={withCoords.map((l) => ({ lat: l.lat!, lng: l.lng! }))}
                resetTrigger={resetTrigger}
              />

              {viewMode === "heat" ? (
                <HeatmapLayer points={heatPoints} />
              ) : (
                withCoords.map((loc) => {
                  const style = getMarkerStyle(loc);
                  return (
                    <CircleMarker
                      key={loc.name}
                      center={[loc.lat!, loc.lng!]}
                      radius={style.radius}
                      pathOptions={{
                        color: style.color,
                        fillColor: style.fillColor,
                        fillOpacity: style.fillOpacity,
                        weight: style.weight,
                        dashArray: style.dashArray,
                      }}
                      eventHandlers={{
                        click: () => {
                          setSelectedLocation(loc);
                        },
                        mouseover: () => {
                          setHoveredLocationName(loc.name);
                        },
                        mouseout: () => {
                          setHoveredLocationName(null);
                        },
                      }}
                    >
                      <Popup>
                        <div className="p-1 text-xs">
                          <p className="font-bold text-[var(--sv-text)]">{loc.name}</p>
                          {loc.block && (
                            <p className="text-[11px] text-[var(--sv-muted)]">{loc.block}</p>
                          )}
                          <div className="mt-1 space-y-0.5 border-t border-[var(--sv-border)] pt-1">
                            <p>
                              Total Scans:{" "}
                              <span className="font-mono font-semibold">{loc.totalScans}</span>
                            </p>
                            <p className="text-[var(--sv-sam)]">
                              SAM Rate: <span className="font-mono font-bold">{loc.samRate}%</span>{" "}
                              ({loc.samCount})
                            </p>
                            <p className="text-[var(--sv-mam)]">
                              GAM Rate: <span className="font-mono">{loc.gamRate}%</span>
                            </p>
                          </div>
                        </div>
                      </Popup>
                    </CircleMarker>
                  );
                })
              )}
            </MapContainer>
          )}
        </div>

        {/* Sidebar Panel (~35% = 4 cols): List + Selected Village Detail */}
        <div className="flex flex-col gap-4 lg:col-span-4 h-[520px] lg:h-[calc(100vh-210px)]">
          {/* Selected Village Detail Card (if any selected) */}
          {selectedLocation ? (
            <Panel className="p-4 border-[var(--sv-primary)]/40 shrink-0">
              <div className="flex items-start justify-between gap-2 border-b border-[var(--sv-border)] pb-2.5">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-[var(--sv-primary)]" />
                    <h3 className="font-semibold text-sm text-[var(--sv-text)]">
                      {selectedLocation.name}
                    </h3>
                  </div>
                  <p className="text-xs text-[var(--sv-muted)]">
                    {[selectedLocation.block, selectedLocation.district]
                      .filter(Boolean)
                      .join(" · ") || "Field Screening Site"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedLocation(null)}
                  className="rounded px-1.5 py-0.5 text-[11px] text-[var(--sv-muted)] hover:bg-[var(--sv-surface-hover)]"
                >
                  Close
                </button>
              </div>

              {/* Counts & Rates */}
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-[var(--sv-surface-hover)] p-2">
                  <p className="text-[10px] text-[var(--sv-muted)]">Total Scans</p>
                  <p className="font-mono text-base font-bold text-[var(--sv-text)]">
                    {formatNumber(selectedLocation.totalScans)}
                  </p>
                </div>
                <div className="rounded-lg bg-[var(--sv-mam)]/10 p-2">
                  <p className="text-[10px] text-[var(--sv-mam)]">GAM Rate</p>
                  <p className="font-mono text-base font-bold text-[var(--sv-mam)]">
                    {selectedLocation.gamRate}%
                  </p>
                </div>
                <div className="rounded-lg bg-[var(--sv-sam)]/10 p-2">
                  <p className="text-[10px] text-[var(--sv-sam)]">SAM Rate</p>
                  <p className="font-mono text-base font-bold text-[var(--sv-sam)]">
                    {selectedLocation.samRate}%
                  </p>
                </div>
              </div>

              {/* Stacked Band Breakdown Bar */}
              <div className="mt-3">
                <div className="flex items-center justify-between text-[11px] text-[var(--sv-muted)] mb-1">
                  <span>Band Breakdown</span>
                  <span className="font-mono">
                    {selectedLocation.normalCount} / {selectedLocation.mamCount} /{" "}
                    {selectedLocation.samCount}
                  </span>
                </div>
                <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[var(--sv-border)]">
                  <div
                    style={{ width: `${selectedLocation.shares.normalPct}%` }}
                    className="bg-[var(--sv-normal)] transition-all"
                    title={`Normal: ${selectedLocation.normalCount} (${selectedLocation.shares.normalPct}%)`}
                  />
                  <div
                    style={{ width: `${selectedLocation.shares.mamPct}%` }}
                    className="bg-[var(--sv-mam)] transition-all"
                    title={`MAM: ${selectedLocation.mamCount} (${selectedLocation.shares.mamPct}%)`}
                  />
                  <div
                    style={{ width: `${selectedLocation.shares.samPct}%` }}
                    className="bg-[var(--sv-sam)] transition-all"
                    title={`SAM: ${selectedLocation.samCount} (${selectedLocation.shares.samPct}%)`}
                  />
                </div>
              </div>

              {/* Covering Workers (matched by trimmed lowercase village name) */}
              <div className="mt-3 border-t border-[var(--sv-border)] pt-2.5">
                <p className="text-xs font-medium text-[var(--sv-text)] mb-1.5 flex items-center gap-1.5">
                  <Users size={14} className="text-[var(--sv-primary)]" />
                  Workers covering this village ({coveringWorkers.length})
                </p>
                {coveringWorkers.length === 0 ? (
                  <p className="text-[11px] text-[var(--sv-muted)] italic">
                    No field workers assigned specifically to this location.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-24 overflow-y-auto pr-1">
                    {coveringWorkers.map((w) => (
                      <div
                        key={w.id}
                        className="flex items-center justify-between rounded border border-[var(--sv-border)]/60 bg-[var(--sv-surface-hover)] px-2 py-1 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="flex size-5 items-center justify-center rounded-full bg-[var(--sv-primary)]/20 text-[10px] font-bold text-[var(--sv-primary)]">
                            {w.initials}
                          </span>
                          <span className="font-medium text-[var(--sv-text)]">{w.name}</span>
                        </div>
                        <span className="font-mono text-[11px] text-[var(--sv-muted)]">
                          {w.phone}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Panel>
          ) : null}

          {/* Village List Panel */}
          <Panel className="flex flex-1 flex-col overflow-hidden p-3">
            {/* Search and Sort Toolbar */}
            <div className="mb-2.5 space-y-2">
              <div className="relative">
                <MagnifyingGlass
                  size={14}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--sv-muted)]"
                />
                <input
                  type="text"
                  placeholder={`Search ${groupBy}s...`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-lg border border-[var(--sv-border)] bg-[var(--sv-surface-hover)] py-1.5 pl-8 pr-3 text-xs text-[var(--sv-text)] outline-none transition focus:border-[var(--sv-primary)]"
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-[var(--sv-muted)]">
                <span>Showing {filteredList.length} locations</span>
                <div className="flex items-center gap-1">
                  <span>Sort:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="rounded border border-[var(--sv-border)] bg-[var(--sv-surface)] px-1.5 py-0.5 text-[11px] text-[var(--sv-text)] outline-none"
                  >
                    <option value="risk_desc">Highest Risk</option>
                    <option value="volume_desc">Highest Volume</option>
                    <option value="name_asc">Name (A-Z)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Scrollable Location List */}
            <div className="flex-1 overflow-y-auto divide-y divide-[var(--sv-border)]/50 pr-1">
              {filteredList.length === 0 ? (
                <div className="py-8 text-center text-xs text-[var(--sv-muted)]">
                  No locations match your search.
                </div>
              ) : (
                filteredList.map((loc) => {
                  const isSelected = selectedLocation?.name === loc.name;
                  const isHovered = hoveredLocationName === loc.name;
                  const isLow = loc.totalScans < 5;

                  return (
                    <button
                      key={loc.name}
                      type="button"
                      onClick={() => {
                        setSelectedLocation(loc);
                      }}
                      onMouseEnter={() => setHoveredLocationName(loc.name)}
                      onMouseLeave={() => setHoveredLocationName(null)}
                      className={`w-full text-left p-2 transition rounded-lg flex items-center justify-between gap-2 ${
                        isSelected
                          ? "bg-[var(--sv-primary)]/10 border border-[var(--sv-primary)]/30"
                          : isHovered
                            ? "bg-[var(--sv-surface-hover)]"
                            : "hover:bg-[var(--sv-surface-hover)]/70"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-[var(--sv-text)]">
                          {loc.name}
                        </p>
                        <p className="truncate text-[10px] text-[var(--sv-muted)]">
                          {[loc.block, loc.district].filter(Boolean).join(" · ") ||
                            `${loc.totalScans} screenings`}
                        </p>
                      </div>

                      <div className="text-right shrink-0 flex items-center gap-2">
                        <div>
                          <p
                            className={`font-mono text-xs font-bold ${
                              loc.samRate >= 10
                                ? "text-[var(--sv-sam)]"
                                : loc.samRate >= 5
                                  ? "text-[var(--sv-mam)]"
                                  : "text-[var(--sv-normal)]"
                            }`}
                          >
                            {loc.samRate}%
                          </p>
                          <p className="font-mono text-[10px] text-[var(--sv-muted)]">
                            {loc.totalScans} scans
                          </p>
                        </div>

                        {/* Status chip */}
                        {isLow ? (
                          <span className="rounded bg-[var(--sv-surface-hover)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--sv-muted)] border border-[var(--sv-border)]">
                            Low n
                          </span>
                        ) : loc.samRate >= 10 ? (
                          <span className="rounded bg-[var(--sv-sam)]/15 px-1.5 py-0.5 text-[9px] font-bold text-[var(--sv-sam)]">
                            SAM
                          </span>
                        ) : loc.samRate >= 5 ? (
                          <span className="rounded bg-[var(--sv-mam)]/15 px-1.5 py-0.5 text-[9px] font-bold text-[var(--sv-mam)]">
                            MAM
                          </span>
                        ) : (
                          <span className="rounded bg-[var(--sv-normal)]/15 px-1.5 py-0.5 text-[9px] font-bold text-[var(--sv-normal)]">
                            Normal
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
