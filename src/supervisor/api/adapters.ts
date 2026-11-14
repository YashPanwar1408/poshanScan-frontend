/**
 * Pure adapter functions: raw API response → clean view models.
 * All side-effect-free — fully unit-testable with Vitest.
 */

import type {
  OverviewRaw,
  TrendsRaw,
  TrendPoint,
  LocationsRaw,
  LocationItem,
  WorkersRaw,
  WorkerItem,
  FlaggedRaw,
  FlaggedItem,
} from "./schemas";

// ── Confidence ────────────────────────────────────────────────────────────────

/**
 * Convert a 0–1 confidence fraction to a display percentage string.
 * This is the ONE place that handles the 0.60 threshold scale.
 */
export function formatConfidence(value: number | undefined | null): string {
  if (value == null || Number.isNaN(value)) return "—";
  const pct = value > 1 ? value : value * 100;
  return `${pct.toFixed(0)}%`;
}

export function confidencePct(value: number | undefined | null): number {
  if (value == null || Number.isNaN(value)) return 0;
  return value > 1 ? value : value * 100;
}

// ── Dates ─────────────────────────────────────────────────────────────────────

/**
 * Treat a missing timezone on a server timestamp as UTC.
 * Flip ASSUME_UTC to false if samples prove server sends local times.
 */
const ASSUME_UTC = true;

export function parseServerDate(raw: string | undefined | null): Date | null {
  if (!raw) return null;
  const s = ASSUME_UTC && !raw.endsWith("Z") && !raw.includes("+") ? `${raw}Z` : raw;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

const IST_FMT = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  dateStyle: "medium",
  timeStyle: "short",
});

const IST_DATE_FMT = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  dateStyle: "medium",
});

export function formatDateIST(raw: string | undefined | null, dateOnly = false): string {
  const d = parseServerDate(raw);
  if (!d) return "—";
  return (dateOnly ? IST_DATE_FMT : IST_FMT).format(d) + " IST";
}

// ── Numbers ───────────────────────────────────────────────────────────────────

const IN_NUM = new Intl.NumberFormat("en-IN");

export function formatNumber(n: number | undefined | null): string {
  if (n == null || Number.isNaN(n)) return "—";
  return IN_NUM.format(n);
}

// ── Band shares ───────────────────────────────────────────────────────────────

export interface BandShares {
  normalPct: number;
  mamPct: number;
  samPct: number;
}

/**
 * Derive prevalence percentages from raw counts.
 * Never trusts a backend-provided percentage to avoid scale confusion.
 */
export function computeBandShares(
  normal: number | undefined,
  mam: number | undefined,
  sam: number | undefined,
): BandShares {
  const n = normal ?? 0;
  const m = mam ?? 0;
  const s = sam ?? 0;
  const total = n + m + s;
  if (total === 0) return { normalPct: 0, mamPct: 0, samPct: 0 };
  return {
    normalPct: (n / total) * 100,
    mamPct: (m / total) * 100,
    samPct: (s / total) * 100,
  };
}

// ── Record ID resolution ──────────────────────────────────────────────────────

export function resolveId(item: {
  id?: string | undefined;
  scan_id?: string | undefined;
  screening_id?: string | undefined;
}): string {
  return item.id ?? item.scan_id ?? item.screening_id ?? "—";
}

// ── Overview adapter ──────────────────────────────────────────────────────────

export interface OverviewVM {
  totalScans: number;
  normalCount: number;
  mamCount: number;
  samCount: number;
  flaggedPending: number;
  activeWorkers: number;
  avgConfidencePct: number;
  shares: BandShares;
}

export function adaptOverview(raw: OverviewRaw): OverviewVM {
  const normal = raw.normal_count ?? raw.band_counts?.NORMAL ?? 0;
  const mam = raw.mam_count ?? raw.band_counts?.MAM ?? 0;
  const sam = raw.sam_count ?? raw.band_counts?.SAM ?? 0;
  const total = raw.total_screenings ?? raw.total_scans ?? normal + mam + sam;
  const avgConf = raw.avg_confidence ?? raw.average_confidence ?? 0;

  return {
    totalScans: total,
    normalCount: normal,
    mamCount: mam,
    samCount: sam,
    flaggedPending: raw.flagged_pending ?? 0,
    activeWorkers: raw.active_workers ?? 0,
    avgConfidencePct: confidencePct(avgConf),
    shares: computeBandShares(normal, mam, sam),
  };
}

// ── Trends adapter ────────────────────────────────────────────────────────────

export interface TrendPointVM {
  date: string;
  total: number;
  normal: number;
  mam: number;
  sam: number;
}

function adaptTrendPoint(p: TrendPoint): TrendPointVM {
  return {
    date: p.date ?? "",
    total: p.total ?? (p.normal_count ?? 0) + (p.mam_count ?? 0) + (p.sam_count ?? 0),
    normal: p.normal_count ?? p.normal ?? 0,
    mam: p.mam_count ?? p.mam ?? 0,
    sam: p.sam_count ?? p.sam ?? 0,
  };
}

export function adaptTrends(raw: TrendsRaw): TrendPointVM[] {
  const points = raw.data ?? raw.points ?? raw.series ?? [];
  return points.map(adaptTrendPoint);
}

/**
 * 7-point (or N-point) moving average of totals over a sorted time series.
 * Points before the window has enough data return null so charts don't misrepresent the start.
 */
export function computeMovingAverage(data: TrendPointVM[], windowSize = 7): (number | null)[] {
  if (windowSize <= 0) return data.map((d) => d.total);
  return data.map((_, i) => {
    if (i < windowSize - 1) return null;
    let sum = 0;
    for (let j = i - windowSize + 1; j <= i; j++) {
      sum += data[j]?.total ?? 0;
    }
    return Number((sum / windowSize).toFixed(1));
  });
}

/**
 * Ensures a continuous daily date series without missing dates so charts never mislead.
 * Missing dates are filled with zero counts.
 */
export function fillDateGaps(
  points: TrendPointVM[],
  startDateStr?: string,
  endDateStr?: string,
): TrendPointVM[] {
  if (points.length === 0 && (!startDateStr || !endDateStr)) return [];
  const map = new Map<string, TrendPointVM>();
  for (const p of points) {
    if (p.date) {
      const key = p.date.slice(0, 10);
      map.set(key, p);
    }
  }

  let start = startDateStr
    ? new Date(startDateStr.slice(0, 10))
    : new Date(points[0]!.date.slice(0, 10));
  let end = endDateStr
    ? new Date(endDateStr.slice(0, 10))
    : new Date(points[points.length - 1]!.date.slice(0, 10));

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return points;
  if (start > end) {
    const tmp = start;
    start = end;
    end = tmp;
  }

  const result: TrendPointVM[] = [];
  const curr = new Date(start);
  while (curr <= end) {
    const key = curr.toISOString().slice(0, 10);
    const existing = map.get(key);
    if (existing) {
      result.push(existing);
    } else {
      result.push({
        date: key,
        total: 0,
        normal: 0,
        mam: 0,
        sam: 0,
      });
    }
    curr.setUTCDate(curr.getUTCDate() + 1);
  }
  return result;
}

/**
 * Pivot grouped trends into wide format: array of { date, [groupName]: count }.
 */
export function pivotTrends(
  points: Array<{
    date: string;
    group?: string;
    count?: number;
    normal?: number;
    mam?: number;
    sam?: number;
  }>,
): Array<Record<string, string | number>> {
  const map = new Map<string, Record<string, string | number>>();
  for (const pt of points) {
    const d = pt.date.slice(0, 10);
    if (!map.has(d)) {
      map.set(d, { date: d });
    }
    const row = map.get(d)!;
    const grp = pt.group ?? "Total";
    const val = pt.count ?? (pt.normal ?? 0) + (pt.mam ?? 0) + (pt.sam ?? 0);
    row[grp] = Number(row[grp] ?? 0) + val;
  }
  return Array.from(map.values()).sort((a, b) =>
    String(a["date"]).localeCompare(String(b["date"])),
  );
}

// ── Deltas ────────────────────────────────────────────────────────────────────

export interface DeltaResult {
  diff: number;
  pctChange: number | null;
}

export function computeDelta(current: number, previous: number): DeltaResult {
  const diff = current - previous;
  if (previous === 0) {
    return { diff, pctChange: current > 0 ? 100 : null };
  }
  return {
    diff,
    pctChange: Number(((diff / previous) * 100).toFixed(1)),
  };
}

// ── Locations adapter ─────────────────────────────────────────────────────────

export interface LocationVM {
  name: string;
  block?: string | undefined;
  district?: string | undefined;
  totalScans: number;
  normalCount: number;
  mamCount: number;
  samCount: number;
  samRate: number;
  gamRate: number;
  shares: BandShares;
  lat?: number | null | undefined;
  lng?: number | null | undefined;
}

const KNOWN_COORDINATES: Record<string, [number, number]> = {
  nandurbar: [21.374, 74.241],
  dharni: [21.432, 77.018],
  chikaldhara: [21.398, 77.348],
  melghat: [21.428, 77.291],
  jawhar: [19.916, 73.232],
  mokhada: [19.938, 73.341],
  palghar: [19.696, 72.765],
  barwani: [22.036, 74.903],
  jhabua: [22.769, 74.596],
  alirajpur: [22.303, 74.352],
  sheopur: [25.669, 76.697],
  dhar: [22.597, 75.297],
  baran: [25.101, 76.513],
  banswara: [23.546, 74.442],
  dungarpur: [23.843, 73.714],
  koraput: [18.813, 82.712],
  rayagada: [19.171, 83.416],
  malkangiri: [18.343, 81.897],
  kalahandi: [19.907, 83.164],
  gumla: [23.043, 84.541],
  chaibasa: [22.551, 85.810],
  ranchi: [23.344, 85.309],
  gadchiroli: [20.185, 80.005],
  thane: [19.218, 72.978],
  nashik: [19.997, 73.789],
  pune: [18.52, 73.856],
  bhopal: [23.259, 77.412],
  indore: [22.719, 75.857],
  nagpur: [21.145, 79.088],
  jaipur: [26.912, 75.787],
  patna: [25.594, 85.137],
  lucknow: [26.846, 80.946],
  delhi: [28.613, 77.209],
  mumbai: [19.076, 72.877],
  sundarpur: [21.84, 76.88],
  rampur: [22.12, 75.45],
  shivpuri: [25.43, 77.65],
  kalyan: [19.24, 73.13],
};

export function getFallbackCoordinates(name: string): [number, number] {
  const key = name.toLowerCase().replace(/[^a-z0-9]/g, "_").trim();
  for (const [k, coords] of Object.entries(KNOWN_COORDINATES)) {
    if (key.includes(k) || k.includes(key)) {
      return coords;
    }
  }
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  const latOffset = ((Math.abs(hash) % 400) / 100) - 2.0;
  const lngOffset = ((Math.abs(hash >> 3) % 400) / 100) - 2.0;
  return [21.5 + latOffset, 76.5 + lngOffset];
}

function adaptLocation(item: LocationItem): LocationVM {
  const name = item.village ?? item.location ?? item.name ?? item.district ?? "Unknown";
  const total = item.total_screenings ?? item.total_scans ?? item.total ?? item.scan_count ?? 0;
  const normal = item.normal ?? item.normal_count ?? 0;
  const mam = item.mam ?? item.mam_count ?? 0;
  const sam = item.sam ?? item.sam_count ?? 0;
  const samRate =
    item.sam_rate != null
      ? item.sam_rate
      : item.prevalence_pct != null
        ? item.prevalence_pct
        : total > 0
          ? (sam / total) * 100
          : 0;
  const gamRate =
    item.at_risk_percentage != null
      ? item.at_risk_percentage
      : total > 0
        ? ((mam + sam) / total) * 100
        : 0;
  const lat = item.lat ?? item.latitude ?? null;
  const lng = item.lng ?? item.longitude ?? null;

  let finalLat = lat != null && !Number.isNaN(lat) && lat !== 0 ? lat : null;
  let finalLng = lng != null && !Number.isNaN(lng) && lng !== 0 ? lng : null;

  if (finalLat == null || finalLng == null) {
    const fallback = getFallbackCoordinates(name);
    finalLat = fallback[0];
    finalLng = fallback[1];
  }

  return {
    name,
    block: item.block,
    district: item.district,
    totalScans: total,
    normalCount: normal,
    mamCount: mam,
    samCount: sam,
    samRate: Number(samRate.toFixed(1)),
    gamRate: Number(gamRate.toFixed(1)),
    shares: computeBandShares(normal, mam, sam),
    lat: finalLat,
    lng: finalLng,
  };
}

export function adaptLocations(raw: LocationsRaw): LocationVM[] {
  const items = Array.isArray(raw) ? raw : (raw.locations ?? raw.data ?? raw.items ?? []);
  return items.map(adaptLocation);
}

/**
 * Aggregates village list client-side by village, block, or district.
 */
export function aggregateLocations(
  locations: LocationVM[],
  groupBy: "village" | "block" | "district",
): LocationVM[] {
  if (groupBy === "village") return locations;

  const map = new Map<
    string,
    {
      name: string;
      block?: string | undefined;
      district?: string | undefined;
      total: number;
      normal: number;
      mam: number;
      sam: number;
      latSum: number;
      lngSum: number;
      coordCount: number;
    }
  >();

  for (const loc of locations) {
    const rawKey = groupBy === "district" ? loc.district || loc.name : loc.block || loc.name;
    const key = rawKey.trim() || "Unknown";

    if (!map.has(key)) {
      map.set(key, {
        name: key,
        block: loc.block,
        district: loc.district,
        total: 0,
        normal: 0,
        mam: 0,
        sam: 0,
        latSum: 0,
        lngSum: 0,
        coordCount: 0,
      });
    }
    const bucket = map.get(key)!;
    bucket.total += loc.totalScans;
    bucket.normal += loc.normalCount;
    bucket.mam += loc.mamCount;
    bucket.sam += loc.samCount;
    if (loc.lat != null && loc.lng != null) {
      bucket.latSum += loc.lat;
      bucket.lngSum += loc.lng;
      bucket.coordCount += 1;
    }
  }

  return Array.from(map.values()).map((b) => {
    const samRate = b.total > 0 ? (b.sam / b.total) * 100 : 0;
    const gamRate = b.total > 0 ? ((b.mam + b.sam) / b.total) * 100 : 0;
    return {
      name: b.name,
      block: b.block,
      district: b.district,
      totalScans: b.total,
      normalCount: b.normal,
      mamCount: b.mam,
      samCount: b.sam,
      samRate: Number(samRate.toFixed(1)),
      gamRate: Number(gamRate.toFixed(1)),
      shares: computeBandShares(b.normal, b.mam, b.sam),
      lat: b.coordCount > 0 ? b.latSum / b.coordCount : null,
      lng: b.coordCount > 0 ? b.lngSum / b.coordCount : null,
    };
  });
}

// ── Workers adapter ───────────────────────────────────────────────────────────

export type WorkerActivityStatus = "active" | "idle" | "dormant" | "never";

export function categorizeWorkerActivity(
  lastActiveRaw?: string | null,
  nowMs = Date.now(),
): WorkerActivityStatus {
  if (!lastActiveRaw) return "never";
  const d = parseServerDate(lastActiveRaw);
  if (!d) return "never";
  const diffMs = nowMs - d.getTime();
  if (diffMs < 0) return "active"; // tolerance for slight clock skew
  const ONE_DAY = 24 * 60 * 60 * 1000;
  if (diffMs <= ONE_DAY) return "active";
  if (diffMs <= 7 * ONE_DAY) return "idle";
  return "dormant";
}

function parseVillages(raw?: string[] | string): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((v) => v.trim()).filter(Boolean);
  return raw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "W";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return ((parts[0][0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}

export interface WorkerVM {
  id: string;
  name: string;
  initials: string;
  phone: string;
  totalScans: number;
  lastActive: string;
  rawLastActive: string | null;
  activityStatus: WorkerActivityStatus;
  assignedVillages: string[];
  avgConfidencePct: number;
  flaggedCount: number;
}

function adaptWorker(item: WorkerItem): WorkerVM {
  const rawLast = item.last_active_at ?? item.last_active ?? item.last_scan_at ?? null;
  const name = item.name ?? item.worker_name ?? "—";
  return {
    id: item.worker_id ?? item.id ?? item.user_id ?? "—",
    name,
    initials: getInitials(name),
    phone: item.phone ?? "—",
    totalScans: item.total_screenings ?? item.total_scans ?? item.scan_count ?? 0,
    lastActive: formatDateIST(rawLast),
    rawLastActive: rawLast,
    activityStatus: categorizeWorkerActivity(rawLast),
    assignedVillages: parseVillages(item.village ?? item.assigned_villages ?? item.villages),
    avgConfidencePct: confidencePct(item.avg_confidence),
    flaggedCount: item.flagged_count ?? 0,
  };
}

export function adaptWorkers(raw: WorkersRaw): WorkerVM[] {
  const items = Array.isArray(raw) ? raw : (raw.workers ?? raw.data ?? raw.items ?? []);
  return items.map(adaptWorker);
}

// ── Flagged adapter ───────────────────────────────────────────────────────────

export interface FlaggedVM {
  id: string;
  referenceCode: string;
  childName: string;
  guardianName?: string | null | undefined;
  gender?: string | null | undefined;
  dob?: string | null | undefined;
  isFlagged?: boolean;
  muacMm: number;
  band: string;
  confidencePct: number;
  createdAt: string;
  rawCreatedAt?: string | null | undefined;
  status: string;
  workerName: string;
  village: string;
  imageUrl?: string | null | undefined;
  sharpness?: number | null | undefined;
  flagReasons: string[];
}

function adaptFlagged(item: FlaggedItem): FlaggedVM {
  const id = resolveId(item);
  const band = item.risk_band ?? item.band ?? "—";
  const conf = confidencePct(item.confidence_score ?? item.confidence);
  const rawDate = item.captured_at ?? item.created_at ?? item.scanned_at ?? null;
  const reasons: string[] = [];
  if (item.reason) {
    reasons.push(item.reason);
  } else {
    if (band.toUpperCase() === "SAM") reasons.push("SAM");
    if (conf < 60) reasons.push("Low confidence (<60%)");
  }
  if (reasons.length === 0) reasons.push("Clinical review");

  const img = item.image_url ?? item.photo_url ?? item.media_url ?? null;
  const sharpness = item.sharpness ?? item.quality_score ?? null;

  const rawChildName = item.child_name ?? (item as Record<string, unknown>).name as string | undefined;
  const childName =
    rawChildName && typeof rawChildName === "string" && rawChildName.trim().length > 0
      ? rawChildName.trim()
      : item.child_ref &&
          !item.child_ref.startsWith("CH-") &&
          !item.child_ref.startsWith("SCN-") &&
          item.child_ref.length > 2
        ? item.child_ref
        : "Child Patient";

  const guardian = (item as Record<string, unknown>).guardian_name as string | undefined;
  const gender = (item as Record<string, unknown>).gender as string | undefined;
  const dob = (item as Record<string, unknown>).dob as string | undefined;

  return {
    id,
    referenceCode:
      id !== "—"
        ? id
        : `SCAN-${Math.abs(hashStr(item.child_ref || item.child_id || item.child_name || "scan"))
            .toString(36)
            .toUpperCase()
            .slice(0, 6)}`,
    childName,
    guardianName: guardian || null,
    gender: gender || null,
    dob: dob || null,
    isFlagged: true,
    muacMm: item.muac_estimate_mm ?? item.muac_mm ?? 0,
    band,
    confidencePct: conf,
    createdAt: formatDateIST(rawDate),
    rawCreatedAt: rawDate,
    status: item.status ?? "pending",
    workerName: item.worker_name ?? "—",
    village: item.village ?? "—",
    imageUrl: img,
    sharpness: sharpness != null ? Number(sharpness.toFixed(1)) : null,
    flagReasons: reasons,
  };
}

function hashStr(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

export function adaptFlaggedList(raw: FlaggedRaw): {
  items: FlaggedVM[];
  pendingCount: number;
} {
  const items = Array.isArray(raw) ? raw : (raw.flagged ?? raw.data ?? raw.items ?? []);
  const pendingCount =
    !Array.isArray(raw) && raw.pending_count != null
      ? raw.pending_count
      : items.filter((i) => (i.status ?? "pending") === "pending").length;
  return { items: items.map(adaptFlagged), pendingCount };
}
