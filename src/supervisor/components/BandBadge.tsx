/**
 * BandBadge — shows NORMAL / MAM / SAM with icon + label.
 * Never relies on colour alone: always has a text label.
 */
import { CheckCircle, Warning, WarningOctagon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

type Band = "NORMAL" | "MAM" | "SAM" | string;

interface BandBadgeProps {
  band: Band;
  size?: "sm" | "md";
  className?: string;
}

const CONFIG: Record<
  "NORMAL" | "MAM" | "SAM",
  { label: string; cls: string; Icon: typeof CheckCircle }
> = {
  NORMAL: { label: "Normal", cls: "band-normal", Icon: CheckCircle },
  MAM: { label: "MAM", cls: "band-mam", Icon: Warning },
  SAM: { label: "SAM", cls: "band-sam", Icon: WarningOctagon },
};

export function BandBadge({ band, size = "md", className }: BandBadgeProps) {
  const upper = band?.toUpperCase() as "NORMAL" | "MAM" | "SAM";
  const cfg = CONFIG[upper] ?? null;

  if (!cfg) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium",
          "border border-[var(--sv-border)] bg-[var(--sv-canvas)] text-[var(--sv-muted)]",
          className,
        )}
      >
        {band || "—"}
      </span>
    );
  }

  const { label, cls, Icon } = cfg;
  const iconSize = size === "sm" ? 13 : 15;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-2 py-0.5 font-medium",
        size === "sm" ? "text-[0.6875rem]" : "text-xs",
        cls,
        className,
      )}
    >
      <Icon size={iconSize} weight="fill" aria-hidden />
      {label}
    </span>
  );
}
