import { z } from "zod";

// ── Shared ──────────────────────────────────────────────────────────────────

/** Band values as returned by the backend */
export const bandSchema = z.enum(["NORMAL", "MAM", "SAM"]);
export type Band = z.infer<typeof bandSchema>;

export const ageCategorySchema = z.enum(["child_6_59m", "adult", "all"]);
export type AgeCategory = z.infer<typeof ageCategorySchema>;

// ── Login ────────────────────────────────────────────────────────────────────

export const loginResponseSchema = z
  .object({
    access_token: z.string().min(1),
    role: z.string(),
    user_id: z.string().optional(),
    name: z.string().optional(),
    expires_in: z.number().optional(),
  })
  .passthrough();

export type LoginResponse = z.infer<typeof loginResponseSchema>;

// ── Overview ─────────────────────────────────────────────────────────────────

export const overviewSchema = z
  .object({
    total_scans: z.number().optional(),
    total_screenings: z.number().optional(),
    normal_count: z.number().optional(),
    mam_count: z.number().optional(),
    sam_count: z.number().optional(),
    flagged_pending: z.number().optional(),
    active_workers: z.number().optional(),
    avg_confidence: z.number().optional(),
    average_confidence: z.number().optional(),
    screenings_today: z.number().optional(),
    /** Some backends may nest counts here */
    band_counts: z
      .object({
        NORMAL: z.number().optional(),
        MAM: z.number().optional(),
        SAM: z.number().optional(),
      })
      .optional(),
  })
  .passthrough();

export type OverviewRaw = z.infer<typeof overviewSchema>;

// ── Trends ────────────────────────────────────────────────────────────────────

export const trendPointSchema = z
  .object({
    date: z.string(),
    total: z.number().optional(),
    normal_count: z.number().optional(),
    mam_count: z.number().optional(),
    sam_count: z.number().optional(),
    normal: z.number().optional(),
    mam: z.number().optional(),
    sam: z.number().optional(),
  })
  .passthrough();

export const trendsSchema = z
  .object({
    data: z.array(trendPointSchema).optional(),
    points: z.array(trendPointSchema).optional(),
    series: z.array(trendPointSchema).optional(),
  })
  .passthrough();

export type TrendsRaw = z.infer<typeof trendsSchema>;
export type TrendPoint = z.infer<typeof trendPointSchema>;

// ── Locations ────────────────────────────────────────────────────────────────

export const locationItemSchema = z
  .object({
    location_id: z.string().optional(),
    location: z.string().optional(),
    village: z.string().optional(),
    block: z.string().optional(),
    district: z.string().optional(),
    name: z.string().optional(),
    total_screenings: z.number().optional(),
    total_scans: z.number().optional(),
    scan_count: z.number().optional(),
    total: z.number().optional(),
    normal: z.number().optional(),
    normal_count: z.number().optional(),
    mam: z.number().optional(),
    mam_count: z.number().optional(),
    sam: z.number().optional(),
    sam_count: z.number().optional(),
    sam_rate: z.number().optional(),
    prevalence_pct: z.number().optional(),
    at_risk_count: z.number().optional(),
    at_risk_percentage: z.number().optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
  })
  .passthrough();

export const locationsSchema = z.union([
  z.array(locationItemSchema),
  z
    .object({
      locations: z.array(locationItemSchema).optional(),
      data: z.array(locationItemSchema).optional(),
      items: z.array(locationItemSchema).optional(),
    })
    .passthrough(),
]);

export type LocationsRaw = z.infer<typeof locationsSchema>;
export type LocationItem = z.infer<typeof locationItemSchema>;

// ── Workers ──────────────────────────────────────────────────────────────────

export const workerItemSchema = z
  .object({
    worker_id: z.string().optional(),
    id: z.string().optional(),
    user_id: z.string().optional(),
    name: z.string().optional(),
    worker_name: z.string().optional(),
    phone: z.string().optional(),
    village: z.string().optional(),
    total_screenings: z.number().optional(),
    total_scans: z.number().optional(),
    scan_count: z.number().optional(),
    last_active: z.string().optional(),
    last_active_at: z.string().optional(),
    last_scan_at: z.string().optional(),
    assigned_villages: z.union([z.array(z.string()), z.string()]).optional(),
    villages: z.union([z.array(z.string()), z.string()]).optional(),
    flagged_count: z.number().optional(),
    avg_confidence: z.number().optional(),
  })
  .passthrough();

export const workersSchema = z.union([
  z.array(workerItemSchema),
  z
    .object({
      workers: z.array(workerItemSchema).optional(),
      data: z.array(workerItemSchema).optional(),
      items: z.array(workerItemSchema).optional(),
    })
    .passthrough(),
]);

export type WorkersRaw = z.infer<typeof workersSchema>;
export type WorkerItem = z.infer<typeof workerItemSchema>;

// ── Flagged ──────────────────────────────────────────────────────────────────

export const flaggedItemSchema = z
  .object({
    id: z.string().optional(),
    scan_id: z.string().optional(),
    screening_id: z.string().optional(),
    child_ref: z.string().optional(),
    child_id: z.string().optional(),
    child_name: z.string().optional(),
    worker_id: z.string().optional(),
    worker_name: z.string().optional(),
    age_category: z.string().optional(),
    muac_estimate_mm: z.number().optional(),
    muac_mm: z.number().optional(),
    risk_band: z.string().optional(),
    band: z.string().optional(),
    confidence_score: z.number().optional(),
    confidence: z.number().optional(),
    reason: z.string().optional(),
    quality_flags: z.array(z.string()).optional(),
    created_at: z.string().optional(),
    captured_at: z.string().optional(),
    scanned_at: z.string().optional(),
    status: z.string().optional(),
    village: z.string().optional(),
    image_url: z.string().optional(),
    photo_url: z.string().optional(),
    media_url: z.string().optional(),
    sharpness: z.number().optional(),
    quality_score: z.number().optional(),
  })
  .passthrough();

export const flaggedSchema = z.union([
  z.array(flaggedItemSchema),
  z
    .object({
      flagged: z.array(flaggedItemSchema).optional(),
      data: z.array(flaggedItemSchema).optional(),
      items: z.array(flaggedItemSchema).optional(),
      total: z.number().optional(),
      pending_count: z.number().optional(),
    })
    .passthrough(),
]);

export type FlaggedRaw = z.infer<typeof flaggedSchema>;
export type FlaggedItem = z.infer<typeof flaggedItemSchema>;
