import { Moon, Sun } from "lucide-react";
import { usePortalPrefs } from "@/lib/portal-prefs";

export function ThemeToggle() {
  const { theme, toggleTheme } = usePortalPrefs();
  const dark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${dark ? "light" : "dark"} mode`}
      aria-pressed={dark}
      title={`Switch to ${dark ? "light" : "dark"} mode`}
      className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {dark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}
