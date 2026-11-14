/**
 * API Inspector (DEV ONLY)
 * Shows every supervisor endpoint: status, latency, raw JSON, adapter parse result.
 */
import { useState } from "react";
import { ArrowsClockwise, CheckCircle, WarningOctagon, Copy } from "@phosphor-icons/react";
import { svClient } from "../api/client";
import { useSvPrefs } from "../store/prefs";
import { ENDPOINTS } from "../api/endpoints";
import {
  overviewSchema,
  trendsSchema,
  locationsSchema,
  workersSchema,
  flaggedSchema,
} from "../api/schemas";
import { PageHeader, Panel } from "../components/Primitives";
import type { AgeCategory } from "../api/schemas";

interface InspectionResult {
  endpoint: string;
  status: number | "network";
  latencyMs: number;
  rawJson: unknown;
  parseOk: boolean;
  parseError?: string | undefined;
}

const INSPECTIONS: {
  label: string;
  path: string;
  schema: { safeParse: (d: unknown) => { success: boolean; error?: { message: string } } };
  params?: (age: AgeCategory) => Record<string, string | number>;
}[] = [
  {
    label: "Overview",
    path: ENDPOINTS.overview,
    schema: overviewSchema,
    params: (age) => ({ age_category: age }),
  },
  {
    label: "Trends",
    path: ENDPOINTS.trends,
    schema: trendsSchema,
    params: (age) => ({ age_category: age, days: 30, group_by: "day" }),
  },
  {
    label: "Locations",
    path: ENDPOINTS.locations,
    schema: locationsSchema,
    params: (age) => ({ age_category: age }),
  },
  {
    label: "Workers",
    path: ENDPOINTS.workers,
    schema: workersSchema,
    params: (age) => ({ age_category: age }),
  },
  {
    label: "Flagged (pending)",
    path: ENDPOINTS.flagged,
    schema: flaggedSchema,
    params: (age) => ({ status: "pending", age_category: age }),
  },
  {
    label: "Flagged (reviewed)",
    path: ENDPOINTS.flagged,
    schema: flaggedSchema,
    params: (age) => ({ status: "reviewed", age_category: age }),
  },
];

export function ApiInspectorPage() {
  const { ageCategory } = useSvPrefs();
  const [results, setResults] = useState<InspectionResult[]>([]);
  const [running, setRunning] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  async function runAll() {
    setRunning(true);
    const out: InspectionResult[] = [];

    for (const insp of INSPECTIONS) {
      const t0 = Date.now();
      try {
        const { data, status } = await svClient.get(insp.path, {
          params: insp.params?.(ageCategory),
        });
        const latencyMs = Date.now() - t0;
        const parsed = insp.schema.safeParse(data);
        out.push({
          endpoint: `${insp.label} — ${insp.path}`,
          status,
          latencyMs,
          rawJson: data,
          parseOk: parsed.success,
          parseError: parsed.success ? undefined : parsed.error?.message,
        });
      } catch (err: unknown) {
        const e = err as { status?: number; message?: string };
        out.push({
          endpoint: `${insp.label} — ${insp.path}`,
          status: e.status ?? "network",
          latencyMs: Date.now() - t0,
          rawJson: null,
          parseOk: false,
          parseError: e.message,
        });
      }
    }

    setResults(out);
    setRunning(false);
  }

  function copyJson(data: unknown) {
    void navigator.clipboard.writeText(JSON.stringify(data, null, 2));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="API Inspector"
        description="Dev-only: calls every supervisor endpoint and shows raw responses."
        actions={
          <button
            type="button"
            id="sv-inspector-run"
            onClick={() => void runAll()}
            disabled={running}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-all disabled:opacity-60"
            style={{ background: "var(--sv-primary)" }}
          >
            <ArrowsClockwise size={14} className={running ? "animate-spin" : ""} />
            {running ? "Running…" : "Run all endpoints"}
          </button>
        }
      />

      {results.length === 0 && !running && (
        <Panel className="p-8 text-center">
          <p className="text-sm text-[var(--sv-muted)]">
            Click "Run all endpoints" to inspect the API.
          </p>
        </Panel>
      )}

      {results.map((r, idx) => {
        const key = `${idx}`;
        const isOpen = !!expanded[key];
        const ok = r.status !== "network" && Number(r.status) < 300;

        return (
          <Panel key={key} className="overflow-hidden">
            <button
              type="button"
              onClick={() => setExpanded((e) => ({ ...e, [key]: !e[key] }))}
              className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-[var(--sv-canvas)]"
            >
              {ok && r.parseOk ? (
                <CheckCircle size={18} weight="fill" style={{ color: "var(--sv-normal)" }} />
              ) : (
                <WarningOctagon size={18} weight="fill" style={{ color: "var(--sv-sam)" }} />
              )}
              <span className="flex-1 text-sm font-medium text-[var(--sv-text)]">{r.endpoint}</span>
              <span
                className="text-xs font-semibold"
                style={{
                  fontFamily: "var(--sv-font-mono)",
                  color:
                    r.status === "network"
                      ? "var(--sv-sam)"
                      : Number(r.status) >= 400
                        ? "var(--sv-sam)"
                        : "var(--sv-normal)",
                }}
              >
                {r.status}
              </span>
              <span
                className="ml-2 text-xs text-[var(--sv-muted)]"
                style={{ fontFamily: "var(--sv-font-mono)" }}
              >
                {r.latencyMs}ms
              </span>
              {r.parseOk ? (
                <span
                  className="ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold"
                  style={{ background: "var(--sv-normal-sf)", color: "var(--sv-normal)" }}
                >
                  parsed ✓
                </span>
              ) : (
                <span
                  className="ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold"
                  style={{ background: "var(--sv-sam-sf)", color: "var(--sv-sam)" }}
                >
                  parse ✗
                </span>
              )}
              <span className="ml-1 text-xs text-[var(--sv-muted)]">{isOpen ? "▲" : "▼"}</span>
            </button>

            {isOpen && (
              <div className="border-t p-4" style={{ borderColor: "var(--sv-border)" }}>
                {r.parseError && (
                  <p
                    className="mb-3 rounded-lg px-3 py-2 text-xs"
                    style={{ background: "var(--sv-sam-sf)", color: "var(--sv-sam)" }}
                  >
                    Parse error: {r.parseError}
                  </p>
                )}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => copyJson(r.rawJson)}
                    className="absolute right-2 top-2 flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors hover:bg-[var(--sv-border)]"
                    style={{ color: "var(--sv-muted)" }}
                  >
                    <Copy size={12} />
                    Copy
                  </button>
                  <pre
                    className="max-h-80 overflow-auto rounded-lg p-4 text-xs leading-relaxed"
                    style={{
                      background: "var(--sv-canvas)",
                      color: "var(--sv-text)",
                      fontFamily: "var(--sv-font-mono)",
                      border: "1px solid var(--sv-border)",
                    }}
                  >
                    {JSON.stringify(r.rawJson, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </Panel>
        );
      })}
    </div>
  );
}
