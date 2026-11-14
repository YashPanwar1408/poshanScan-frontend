/** KpiCard — animated number count-up on first render with sparkline and delta */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowUpRight, ArrowDownRight } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export interface KpiCardProps {
  label: string;
  value: number | string;
  subtext?: string | undefined;
  sublabel?: string | undefined;
  icon?: ReactNode | undefined;
  accentClass?: string | undefined;
  className?: string | undefined;
  animate?: boolean | undefined;
  sparklineData?: number[] | undefined;
  sparklineColor?: string | undefined;
  delta?: { diff: number; pctChange: number | null } | undefined;
  deltaPeriod?: string | undefined;
  gaugePct?: number | undefined;
}

function useCountUp(target: number, animate: boolean) {
  const [display, setDisplay] = useState(target);
  const currentDisplayRef = useRef(display);
  currentDisplayRef.current = display;

  useEffect(() => {
    if (!animate) {
      setDisplay(target);
      return;
    }

    const startVal = currentDisplayRef.current;
    const endVal = target;
    if (startVal === endVal) return;

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      setDisplay(target);
      return;
    }

    const duration = 800;
    const start = Date.now();
    let rafId: number;

    function step() {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(startVal + (endVal - startVal) * eased));
      if (progress < 1) {
        rafId = requestAnimationFrame(step);
      }
    }

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [target, animate]);

  return display;
}

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 80;
  const height = 24;

  const points = data
    .map((val, idx) => {
      const x = (idx / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className="overflow-visible" aria-hidden="true">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

function RadialGauge({ pct }: { pct: number }) {
  const radius = 18;
  const circ = 2 * Math.PI * radius;
  const strokePct = Math.min(Math.max(pct, 0), 100);
  const strokeDashoffset = circ - (strokePct / 100) * circ;

  return (
    <div className="relative flex size-11 items-center justify-center">
      <svg className="size-11 -rotate-90" viewBox="0 0 44 44" aria-hidden="true">
        <circle
          cx="22"
          cy="22"
          r={radius}
          className="stroke-[var(--sv-border)]"
          strokeWidth="3.5"
          fill="none"
        />
        <circle
          cx="22"
          cy="22"
          r={radius}
          className="stroke-[var(--sv-primary)] transition-all duration-700 ease-out"
          strokeWidth="3.5"
          fill="none"
          strokeDasharray={circ}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </svg>
      <span
        className="absolute text-[11px] font-bold text-[var(--sv-text)]"
        style={{ fontFamily: "var(--sv-font-mono)" }}
      >
        {Math.round(pct)}%
      </span>
    </div>
  );
}

export function KpiCard({
  label,
  value,
  subtext,
  sublabel,
  icon,
  accentClass,
  className,
  animate = true,
  sparklineData,
  sparklineColor = "var(--sv-primary)",
  delta,
  deltaPeriod = "vs prior 14d",
  gaugePct,
}: KpiCardProps) {
  const isNum = typeof value === "number";
  const counted = useCountUp(isNum ? value : 0, animate && isNum);
  const display = isNum ? counted.toLocaleString("en-IN") : value;

  return (
    <div
      className={cn(
        "sv-card flex flex-col justify-between gap-3 p-4 transition-all duration-200",
        "hover:shadow-[var(--sv-shadow-md)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="sv-eyebrow">{label}</span>
        {gaugePct != null ? (
          <RadialGauge pct={gaugePct} />
        ) : icon ? (
          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-lg",
              accentClass ?? "bg-[var(--sv-primary-sf)] text-[var(--sv-primary)]",
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <p
          className="font-mono text-2xl font-bold tracking-tight text-[var(--sv-text)]"
          style={{ fontFamily: "var(--sv-font-mono)" }}
        >
          {display}
        </p>
        {sparklineData && sparklineData.length > 1 && (
          <MiniSparkline data={sparklineData} color={sparklineColor} />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
        {(subtext ?? sublabel) && <p className="text-[var(--sv-muted)]">{subtext ?? sublabel}</p>}
        {delta && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 font-mono text-[11px] font-medium",
              delta.diff > 0
                ? "text-[var(--sv-normal)]"
                : delta.diff < 0
                  ? "text-[var(--sv-muted)]"
                  : "text-[var(--sv-muted)]",
            )}
            title={`${delta.diff > 0 ? "+" : ""}${delta.diff.toLocaleString("en-IN")} ${deltaPeriod}`}
          >
            {delta.diff >= 0 ? (
              <ArrowUpRight size={13} weight="bold" />
            ) : (
              <ArrowDownRight size={13} weight="bold" />
            )}
            {delta.pctChange != null ? `${Math.abs(delta.pctChange)}%` : `${Math.abs(delta.diff)}`}
            <span className="ml-0.5 text-[10px] opacity-75">{deltaPeriod}</span>
          </span>
        )}
      </div>
    </div>
  );
}
