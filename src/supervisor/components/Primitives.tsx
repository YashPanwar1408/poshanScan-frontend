/** Shared layout primitives for the supervisor portal */
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

// ── Panel ──────────────────────────────────────────────────────────────────

interface PanelProps {
  children: ReactNode;
  className?: string;
}

export function Panel({ children, className }: PanelProps) {
  return <div className={cn("sv-card", className)}>{children}</div>;
}

// ── PageHeader ─────────────────────────────────────────────────────────────

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 pb-6">
      <div>
        <h1
          className="text-2xl font-semibold tracking-tight text-[var(--sv-text)]"
          style={{ fontFamily: "var(--sv-font-display)" }}
        >
          {title}
        </h1>
        {description && <p className="mt-1 text-sm text-[var(--sv-muted)]">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

// ── EmptyState ─────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      {icon && <span className="text-[var(--sv-muted)] opacity-60">{icon}</span>}
      <div className="space-y-1">
        <p className="text-sm font-semibold text-[var(--sv-text)]">{title}</p>
        {description && <p className="text-xs text-[var(--sv-muted)]">{description}</p>}
      </div>
      {action}
    </div>
  );
}

// ── ErrorState ─────────────────────────────────────────────────────────────

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  detail?: string;
}

export function ErrorState({ message, onRetry, detail }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <div
        className="flex size-12 items-center justify-center rounded-full"
        style={{ background: "var(--sv-sam-sf)", color: "var(--sv-sam)" }}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
          <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M10 6v4M10 13.5v.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <div className="space-y-1 max-w-xs">
        <p className="text-sm font-semibold text-[var(--sv-text)]">
          {message ?? "Something went wrong"}
        </p>
        {detail && <p className="text-xs text-[var(--sv-muted)]">{detail}</p>}
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
          style={{
            background: "var(--sv-primary-sf)",
            color: "var(--sv-primary)",
          }}
        >
          Try again
        </button>
      )}
    </div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn("animate-pulse rounded", className)}
      style={{ background: "var(--sv-border)" }}
    />
  );
}

export function KpiCardSkeleton() {
  return (
    <div className="sv-card p-5 space-y-3">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-2 w-32" />
    </div>
  );
}

// ── StatusDot ──────────────────────────────────────────────────────────────

interface StatusDotProps {
  status: "online" | "slow" | "offline";
  latencyMs?: number | null | undefined;
}

export function StatusDot({ status, latencyMs }: StatusDotProps) {
  const colors: Record<string, string> = {
    online: "var(--sv-normal)",
    slow: "var(--sv-mam)",
    offline: "var(--sv-sam)",
  };
  const labels: Record<string, string> = {
    online: "API online",
    slow: "API slow",
    offline: "API offline",
  };

  return (
    <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: colors[status] }}>
      <span className="size-2 rounded-full" style={{ background: colors[status] }} aria-hidden />
      <span
        className="sv-mono"
        style={{ color: "var(--sv-ink-muted)", fontFamily: "var(--sv-font-mono)" }}
      >
        {labels[status]}
        {latencyMs != null && status !== "offline" && ` · ${latencyMs}ms`}
      </span>
    </span>
  );
}

// ── SegmentedControl ───────────────────────────────────────────────────────

interface Segment<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

interface SegmentedControlProps<T extends string> {
  segments: Segment<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}

export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      className={cn("inline-flex items-center gap-0.5 rounded-lg p-0.5", className)}
      role="group"
      style={{ background: "var(--sv-border)" }}
    >
      {segments.map((seg) => {
        const active = seg.value === value;
        return (
          <button
            key={seg.value}
            type="button"
            onClick={() => onChange(seg.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-all duration-150",
              active ? "shadow-sm" : "hover:opacity-80",
            )}
            style={
              active
                ? {
                    background: "var(--sv-surface)",
                    color: "var(--sv-primary)",
                    boxShadow: "var(--sv-shadow-sm)",
                  }
                : { color: "var(--sv-muted)" }
            }
            aria-pressed={active}
          >
            {seg.icon}
            {seg.label}
          </button>
        );
      })}
    </div>
  );
}

export { KpiCard } from "./KpiCard";
