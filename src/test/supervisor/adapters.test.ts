/**
 * Unit tests for supervisor API adapters.
 * Pure functions — no mocks needed.
 */
import { describe, it, expect } from "vitest";
import {
  formatConfidence,
  confidencePct,
  parseServerDate,
  formatNumber,
  computeBandShares,
  resolveId,
  adaptOverview,
  adaptTrends,
  adaptLocations,
  adaptWorkers,
  adaptFlaggedList,
  computeMovingAverage,
  fillDateGaps,
  pivotTrends,
  categorizeWorkerActivity,
  aggregateLocations,
  computeDelta,
} from "../../supervisor/api/adapters";

// ── formatConfidence ──────────────────────────────────────────────────────────

describe("formatConfidence", () => {
  it("converts 0-1 fraction to percent string", () => {
    expect(formatConfidence(0.87)).toBe("87%");
    expect(formatConfidence(0.6)).toBe("60%");
  });
  it("handles values already >1 (already pct)", () => {
    expect(formatConfidence(87)).toBe("87%");
  });
  it("returns em-dash for nullish", () => {
    expect(formatConfidence(null)).toBe("—");
    expect(formatConfidence(undefined)).toBe("—");
    expect(formatConfidence(NaN)).toBe("—");
  });
});

// ── confidencePct ─────────────────────────────────────────────────────────────

describe("confidencePct", () => {
  it("multiplies 0-1 by 100", () => {
    expect(confidencePct(0.6)).toBeCloseTo(60);
  });
  it("returns value as-is if >1", () => {
    expect(confidencePct(87)).toBe(87);
  });
  it("returns 0 for nullish", () => {
    expect(confidencePct(null)).toBe(0);
    expect(confidencePct(undefined)).toBe(0);
  });
});

// ── parseServerDate ───────────────────────────────────────────────────────────

describe("parseServerDate", () => {
  it("parses ISO with Z", () => {
    const d = parseServerDate("2024-01-15T10:30:00Z");
    expect(d).toBeInstanceOf(Date);
    expect(d!.getUTCHours()).toBe(10);
  });
  it("treats naive timestamp as UTC", () => {
    const d = parseServerDate("2024-01-15T10:30:00");
    expect(d).toBeInstanceOf(Date);
    expect(d!.getUTCHours()).toBe(10);
  });
  it("returns null for empty/null", () => {
    expect(parseServerDate(null)).toBeNull();
    expect(parseServerDate("")).toBeNull();
    expect(parseServerDate("invalid")).toBeNull();
  });
});

// ── formatNumber ──────────────────────────────────────────────────────────────

describe("formatNumber", () => {
  it("formats numbers in en-IN locale", () => {
    // en-IN uses commas differently (1,00,000 for 100000)
    const result = formatNumber(1000);
    expect(result).toMatch(/1[,.]?000|1,000/); // tolerant of locale variation
  });
  it("returns em-dash for null/undefined/NaN", () => {
    expect(formatNumber(null)).toBe("—");
    expect(formatNumber(undefined)).toBe("—");
    expect(formatNumber(NaN)).toBe("—");
  });
});

// ── computeBandShares ─────────────────────────────────────────────────────────

describe("computeBandShares", () => {
  it("computes percentages from counts", () => {
    const shares = computeBandShares(80, 15, 5);
    expect(shares.normalPct).toBeCloseTo(80);
    expect(shares.mamPct).toBeCloseTo(15);
    expect(shares.samPct).toBeCloseTo(5);
  });
  it("returns all zeros for zero total", () => {
    const shares = computeBandShares(0, 0, 0);
    expect(shares.normalPct).toBe(0);
    expect(shares.mamPct).toBe(0);
    expect(shares.samPct).toBe(0);
  });
  it("handles undefined inputs", () => {
    const shares = computeBandShares(undefined, undefined, undefined);
    expect(shares.normalPct).toBe(0);
  });
});

// ── resolveId ─────────────────────────────────────────────────────────────────

describe("resolveId", () => {
  it("prefers id", () => {
    expect(resolveId({ id: "a", scan_id: "b", screening_id: "c" })).toBe("a");
  });
  it("falls back to scan_id", () => {
    expect(resolveId({ scan_id: "b", screening_id: "c" })).toBe("b");
  });
  it("falls back to screening_id", () => {
    expect(resolveId({ screening_id: "c" })).toBe("c");
  });
  it("returns em-dash if all missing", () => {
    expect(resolveId({})).toBe("—");
  });
});

// ── adaptOverview ─────────────────────────────────────────────────────────────

describe("adaptOverview", () => {
  it("handles standard field names", () => {
    const vm = adaptOverview({
      total_scans: 100,
      normal_count: 70,
      mam_count: 20,
      sam_count: 10,
      flagged_pending: 3,
      active_workers: 12,
      avg_confidence: 0.82,
    });
    expect(vm.totalScans).toBe(100);
    expect(vm.normalCount).toBe(70);
    expect(vm.mamCount).toBe(20);
    expect(vm.samCount).toBe(10);
    expect(vm.flaggedPending).toBe(3);
    expect(vm.activeWorkers).toBe(12);
    expect(vm.avgConfidencePct).toBeCloseTo(82);
    expect(vm.shares.normalPct).toBeCloseTo(70);
  });

  it("falls back to band_counts nested object", () => {
    const vm = adaptOverview({
      total_scans: 50,
      band_counts: { NORMAL: 30, MAM: 15, SAM: 5 },
    });
    expect(vm.normalCount).toBe(30);
    expect(vm.mamCount).toBe(15);
    expect(vm.samCount).toBe(5);
  });
});

// ── adaptTrends ───────────────────────────────────────────────────────────────

describe("adaptTrends", () => {
  it("reads from data array", () => {
    const vms = adaptTrends({
      data: [{ date: "2024-01-01", normal_count: 5, mam_count: 2, sam_count: 1 }],
    });
    expect(vms).toHaveLength(1);
    expect(vms[0]!.normal).toBe(5);
    expect(vms[0]!.mam).toBe(2);
    expect(vms[0]!.sam).toBe(1);
    expect(vms[0]!.total).toBe(8);
  });

  it("reads from points array as fallback", () => {
    const vms = adaptTrends({
      points: [{ date: "2024-01-02", normal: 3, mam: 1, sam: 0, total: 4 }],
    });
    expect(vms[0]!.total).toBe(4);
  });

  it("returns empty array if no data field", () => {
    expect(adaptTrends({})).toEqual([]);
  });
});

// ── adaptLocations ────────────────────────────────────────────────────────────

describe("adaptLocations", () => {
  it("reads from locations array", () => {
    const vms = adaptLocations({
      locations: [
        {
          village: "Sundarpur",
          total_scans: 40,
          normal_count: 25,
          mam_count: 10,
          sam_count: 5,
        },
      ],
    });
    expect(vms[0]!.name).toBe("Sundarpur");
    expect(vms[0]!.samRate).toBeCloseTo(12.5);
  });
});

// ── adaptWorkers ──────────────────────────────────────────────────────────────

describe("adaptWorkers", () => {
  it("maps workers fields", () => {
    const vms = adaptWorkers({
      workers: [
        {
          worker_id: "w1",
          name: "Priya",
          phone: "9000000001",
          total_scans: 20,
          last_active: "2024-01-10T08:00:00Z",
        },
      ],
    });
    expect(vms[0]!.id).toBe("w1");
    expect(vms[0]!.name).toBe("Priya");
    expect(vms[0]!.totalScans).toBe(20);
    expect(vms[0]!.lastActive).toContain("IST");
  });
});

// ── adaptFlaggedList ──────────────────────────────────────────────────────────

describe("adaptFlaggedList", () => {
  it("reads flagged array and counts pending", () => {
    const result = adaptFlaggedList({
      flagged: [
        {
          id: "f1",
          muac_estimate_mm: 108,
          risk_band: "SAM",
          confidence_score: 0.55,
          status: "pending",
        },
        {
          id: "f2",
          muac_estimate_mm: 118,
          risk_band: "MAM",
          confidence_score: 0.7,
          status: "reviewed",
        },
      ],
    });
    expect(result.items).toHaveLength(2);
    expect(result.pendingCount).toBe(1);
    expect(result.items[0]!.muacMm).toBe(108);
    expect(result.items[0]!.confidencePct).toBeCloseTo(55);
  });
});

// ── computeMovingAverage ──────────────────────────────────────────────────────

describe("computeMovingAverage", () => {
  it("computes 7-point moving average and yields null before window", () => {
    const data = [
      { date: "2024-01-01", total: 10, normal: 8, mam: 1, sam: 1 },
      { date: "2024-01-02", total: 20, normal: 18, mam: 1, sam: 1 },
      { date: "2024-01-03", total: 30, normal: 28, mam: 1, sam: 1 },
      { date: "2024-01-04", total: 40, normal: 38, mam: 1, sam: 1 },
      { date: "2024-01-05", total: 50, normal: 48, mam: 1, sam: 1 },
      { date: "2024-01-06", total: 60, normal: 58, mam: 1, sam: 1 },
      { date: "2024-01-07", total: 70, normal: 68, mam: 1, sam: 1 },
      { date: "2024-01-08", total: 80, normal: 78, mam: 1, sam: 1 },
    ];
    const ma = computeMovingAverage(data, 7);
    expect(ma[0]).toBeNull();
    expect(ma[5]).toBeNull();
    // Sum 10+20+30+40+50+60+70 = 280 / 7 = 40
    expect(ma[6]).toBe(40);
    // Sum 20+30+40+50+60+70+80 = 350 / 7 = 50
    expect(ma[7]).toBe(50);
  });
});

// ── fillDateGaps ──────────────────────────────────────────────────────────────

describe("fillDateGaps", () => {
  it("fills missing dates with 0-count points", () => {
    const sparse = [
      { date: "2024-01-01", total: 5, normal: 4, mam: 1, sam: 0 },
      { date: "2024-01-04", total: 10, normal: 8, mam: 1, sam: 1 },
    ];
    const filled = fillDateGaps(sparse);
    expect(filled).toHaveLength(4);
    expect(filled[0]!.date).toBe("2024-01-01");
    expect(filled[0]!.total).toBe(5);
    expect(filled[1]!.date).toBe("2024-01-02");
    expect(filled[1]!.total).toBe(0);
    expect(filled[2]!.date).toBe("2024-01-03");
    expect(filled[2]!.total).toBe(0);
    expect(filled[3]!.date).toBe("2024-01-04");
    expect(filled[3]!.total).toBe(10);
  });
});

// ── pivotTrends ───────────────────────────────────────────────────────────────

describe("pivotTrends", () => {
  it("pivots grouped points into wide format", () => {
    const grouped = [
      { date: "2024-01-01", group: "North", count: 12 },
      { date: "2024-01-01", group: "South", count: 8 },
      { date: "2024-01-02", group: "North", count: 15 },
    ];
    const pivoted = pivotTrends(grouped);
    expect(pivoted).toHaveLength(2);
    expect(pivoted[0]!["date"]).toBe("2024-01-01");
    expect(pivoted[0]!["North"]).toBe(12);
    expect(pivoted[0]!["South"]).toBe(8);
    expect(pivoted[1]!["date"]).toBe("2024-01-02");
    expect(pivoted[1]!["North"]).toBe(15);
  });
});

// ── categorizeWorkerActivity ──────────────────────────────────────────────────

describe("categorizeWorkerActivity", () => {
  const fixedNow = new Date("2024-01-15T12:00:00Z").getTime();

  it("identifies active workers (<= 24h)", () => {
    const status = categorizeWorkerActivity("2024-01-15T02:00:00Z", fixedNow);
    expect(status).toBe("active");
  });

  it("identifies idle workers (> 24h and <= 7d)", () => {
    const status = categorizeWorkerActivity("2024-01-12T12:00:00Z", fixedNow);
    expect(status).toBe("idle");
  });

  it("identifies dormant workers (> 7d)", () => {
    const status = categorizeWorkerActivity("2024-01-01T12:00:00Z", fixedNow);
    expect(status).toBe("dormant");
  });

  it("handles null or missing last active as never", () => {
    expect(categorizeWorkerActivity(null, fixedNow)).toBe("never");
    expect(categorizeWorkerActivity(undefined, fixedNow)).toBe("never");
  });
});

// ── aggregateLocations ────────────────────────────────────────────────────────

describe("aggregateLocations", () => {
  const locs = [
    {
      name: "Village A",
      block: "Block 1",
      district: "District X",
      totalScans: 10,
      normalCount: 7,
      mamCount: 2,
      samCount: 1,
      samRate: 10,
      gamRate: 30,
      shares: { normalPct: 70, mamPct: 20, samPct: 10 },
      lat: 25.1,
      lng: 85.1,
    },
    {
      name: "Village B",
      block: "Block 1",
      district: "District X",
      totalScans: 20,
      normalCount: 15,
      mamCount: 3,
      samCount: 2,
      samRate: 10,
      gamRate: 25,
      shares: { normalPct: 75, mamPct: 15, samPct: 10 },
      lat: 25.2,
      lng: 85.2,
    },
  ];

  it("aggregates by block correctly", () => {
    const aggregated = aggregateLocations(locs, "block");
    expect(aggregated).toHaveLength(1);
    expect(aggregated[0]!.name).toBe("Block 1");
    expect(aggregated[0]!.totalScans).toBe(30);
    expect(aggregated[0]!.samCount).toBe(3);
    expect(aggregated[0]!.samRate).toBe(10);
    expect(aggregated[0]!.lat).toBeCloseTo(25.15);
  });
});

// ── computeDelta ──────────────────────────────────────────────────────────────

describe("computeDelta", () => {
  it("computes positive delta and percentage change", () => {
    const res = computeDelta(120, 100);
    expect(res.diff).toBe(20);
    expect(res.pctChange).toBe(20);
  });

  it("computes negative delta and percentage change", () => {
    const res = computeDelta(80, 100);
    expect(res.diff).toBe(-20);
    expect(res.pctChange).toBe(-20);
  });

  it("handles previous value of 0 gracefully without NaN/Infinity", () => {
    const res = computeDelta(50, 0);
    expect(res.diff).toBe(50);
    expect(res.pctChange).toBe(100);

    const zeroRes = computeDelta(0, 0);
    expect(zeroRes.diff).toBe(0);
    expect(zeroRes.pctChange).toBeNull();
  });
});
