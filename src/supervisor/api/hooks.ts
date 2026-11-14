import { useQuery, useMutation, keepPreviousData } from "@tanstack/react-query";
import { svClient } from "./client";
import { ENDPOINTS } from "./endpoints";
import type { AgeCategory } from "./schemas";
import {
  overviewSchema,
  trendsSchema,
  locationsSchema,
  workersSchema,
  flaggedSchema,
} from "./schemas";
import {
  adaptOverview,
  adaptTrends,
  adaptLocations,
  adaptWorkers,
  adaptFlaggedList,
  type OverviewVM,
  type TrendPointVM,
  type LocationVM,
  type WorkerVM,
  type FlaggedVM,
} from "./adapters";
import type { ApiError } from "./client";

const STALE = 30_000; // 30 s

type FlaggedStatus = "pending" | "reviewed";

// ── Helper: safe parse with logging ──────────────────────────────────────────

function safeParse<T>(
  schema: {
    safeParse: (data: unknown) => { success: boolean; data?: T; error?: { issues: unknown[] } };
  },
  data: unknown,
  endpoint: string,
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.warn("[sv-api] Schema mismatch at", endpoint, result.error?.issues);
    throw new Error("Response format unexpected");
  }
  return result.data as T;
}

// ── Overview ──────────────────────────────────────────────────────────────────

export function useOverview(ageCategory: AgeCategory) {
  return useQuery<OverviewVM, ApiError>({
    queryKey: ["sv", "overview", ageCategory],
    queryFn: async () => {
      const { data } = await svClient.get(ENDPOINTS.overview, {
        params: { age_category: ageCategory },
      });
      const raw = safeParse(overviewSchema, data, ENDPOINTS.overview);
      return adaptOverview(raw);
    },
    staleTime: STALE,
    placeholderData: keepPreviousData,
    retry: (count, error) => {
      const e = error as ApiError;
      return (e.status === 0 || e.status >= 500) && count < 2;
    },
  });
}

// ── Trends ────────────────────────────────────────────────────────────────────

export interface TrendsParams {
  ageCategory: AgeCategory;
  days?: number;
  groupBy?: string;
  interval?: string;
  from?: string;
  to?: string;
}

export function useTrends(params: TrendsParams) {
  return useQuery<TrendPointVM[], ApiError>({
    queryKey: ["sv", "trends", params],
    queryFn: async () => {
      const queryParams: Record<string, string | number> = {
        age_category: params.ageCategory,
        group_by: params.groupBy ?? "day",
      };
      if (params.from && params.to) {
        queryParams["from"] = params.from;
        queryParams["to"] = params.to;
      } else {
        queryParams["days"] = params.days ?? 30;
      }
      if (params.interval) {
        queryParams["interval"] = params.interval;
      }

      const { data } = await svClient.get(ENDPOINTS.trends, {
        params: queryParams,
      });
      const raw = safeParse(trendsSchema, data, ENDPOINTS.trends);
      return adaptTrends(raw);
    },
    staleTime: STALE,
    placeholderData: keepPreviousData,
    retry: (count, error) => {
      const e = error as ApiError;
      return (e.status === 0 || e.status >= 500) && count < 2;
    },
  });
}

// ── Locations ─────────────────────────────────────────────────────────────────

export function useLocations(ageCategory: AgeCategory) {
  return useQuery<LocationVM[], ApiError>({
    queryKey: ["sv", "locations", ageCategory],
    queryFn: async () => {
      const { data } = await svClient.get(ENDPOINTS.locations, {
        params: { age_category: ageCategory },
      });
      const raw = safeParse(locationsSchema, data, ENDPOINTS.locations);
      return adaptLocations(raw);
    },
    staleTime: STALE,
    placeholderData: keepPreviousData,
    retry: (count, error) => {
      const e = error as ApiError;
      return (e.status === 0 || e.status >= 500) && count < 2;
    },
  });
}

// ── Workers ───────────────────────────────────────────────────────────────────

export function useWorkers(ageCategory: AgeCategory) {
  return useQuery<WorkerVM[], ApiError>({
    queryKey: ["sv", "workers", ageCategory],
    queryFn: async () => {
      const { data } = await svClient.get(ENDPOINTS.workers, {
        params: { age_category: ageCategory },
      });
      const raw = safeParse(workersSchema, data, ENDPOINTS.workers);
      return adaptWorkers(raw);
    },
    staleTime: STALE,
    placeholderData: keepPreviousData,
    retry: (count, error) => {
      const e = error as ApiError;
      return (e.status === 0 || e.status >= 500) && count < 2;
    },
  });
}

// ── Flagged ───────────────────────────────────────────────────────────────────

export function useFlagged(status: FlaggedStatus, ageCategory: AgeCategory) {
  return useQuery<{ items: FlaggedVM[]; pendingCount: number }, ApiError>({
    queryKey: ["sv", "flagged", status, ageCategory],
    queryFn: async () => {
      const { data } = await svClient.get(ENDPOINTS.flagged, {
        params: { status, age_category: ageCategory },
      });
      const raw = safeParse(flaggedSchema, data, ENDPOINTS.flagged);
      return adaptFlaggedList(raw);
    },
    staleTime: STALE,
    placeholderData: keepPreviousData,
    retry: (count, error) => {
      const e = error as ApiError;
      return (e.status === 0 || e.status >= 500) && count < 2;
    },
  });
}

// ── Flagged review mutation ───────────────────────────────────────────────────

export function useReviewFlagged() {
  return useMutation<unknown, ApiError, string>({
    mutationFn: (id: string) => svClient.post(ENDPOINTS.flaggedReview(id)).then((r) => r.data),
  });
}

// ── Registered Children Search ────────────────────────────────────────────────

export interface RegisteredChildVM {
  id: string;
  child_id?: string;
  name: string;
  dob?: string;
  gender?: string;
  guardian_name?: string | null;
  village?: string | null;
}

export function useChildrenSearch(query = "") {
  return useQuery<RegisteredChildVM[], ApiError>({
    queryKey: ["sv", "children-search", query],
    queryFn: async () => {
      try {
        const { data } = await svClient.get("/children/search", {
          params: { q: query.trim().slice(0, 100) },
        });
        return Array.isArray(data) ? data : (data?.children ?? []);
      } catch (e) {
        console.warn("Children search fallback:", e);
        return [];
      }
    },
    staleTime: STALE,
  });
}
