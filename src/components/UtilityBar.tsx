import { MsIcon } from "@/components/MsIcon";
import { usePortalPrefs, type TextScale } from "@/lib/portal-prefs";
import { ThemeToggle } from "@/components/ThemeToggle";

const scales: { id: TextScale; label: string; title: string }[] = [
  { id: "sm", label: "A−", title: "Decrease text size" },
  { id: "md", label: "A", title: "Default text size" },
  { id: "lg", label: "A+", title: "Increase text size" },
];

export function UtilityBar() {
  const { textScale, highContrast, setTextScale, toggleHighContrast } = usePortalPrefs();

  return (
    <div className="border-b border-border bg-[#F1EFEA] text-[11px] text-foreground high-contrast:bg-black">
      <div className="mx-auto flex h-8 max-w-7xl items-center justify-end gap-5 px-6 lg:px-10">
        <div className="flex items-center gap-px" role="group" aria-label="Text size">
          {scales.map((scale) => (
            <button
              key={scale.id}
              type="button"
              title={scale.title}
              aria-pressed={textScale === scale.id}
              onClick={() => setTextScale(scale.id)}
              className={`min-w-7 px-1.5 py-0.5 font-sans leading-none ${
                textScale === scale.id
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-white"
              }`}
            >
              <span
                className={
                  scale.id === "sm"
                    ? "text-[10px]"
                    : scale.id === "lg"
                      ? "text-[13px]"
                      : "text-[12px]"
                }
              >
                {scale.label}
              </span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={toggleHighContrast}
          aria-pressed={highContrast}
          className="inline-flex items-center gap-1.5 hover:underline"
        >
          <MsIcon name="contrast" size={14} />
          High contrast
        </button>
        <ThemeToggle />
        <span className="inline-flex items-center gap-1.5 text-muted-foreground" title="Language">
          <MsIcon name="language" size={14} />
          English
        </span>
      </div>
    </div>
  );
}
