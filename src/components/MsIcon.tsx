import { cn } from "@/lib/utils";

export function MsIcon({
  name,
  className,
  size = 24,
}: {
  name: string;
  className?: string;
  size?: number;
}) {
  return (
    <span
      className={cn("material-symbols-outlined select-none", className)}
      style={{
        fontSize: size,
        width: size,
        height: size,
        lineHeight: 1,
        fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
      }}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}
