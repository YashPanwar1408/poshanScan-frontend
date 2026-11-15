import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type TextScale = "sm" | "md" | "lg";
export type PortalTheme = "light" | "dark";

type PortalPrefs = {
  textScale: TextScale;
  highContrast: boolean;
  theme: PortalTheme;
  setTextScale: (scale: TextScale) => void;
  setTheme: (theme: PortalTheme) => void;
  toggleHighContrast: () => void;
  toggleTheme: () => void;
};

const STORAGE_KEY = "poshanscan_portal_prefs";
const PrefsContext = createContext<PortalPrefs | null>(null);

function readStored(): { textScale: TextScale; highContrast: boolean; theme: PortalTheme } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { textScale: "md", highContrast: false, theme: "light" };
    const parsed = JSON.parse(raw) as {
      textScale?: TextScale;
      highContrast?: boolean;
      theme?: PortalTheme;
    };
    const textScale =
      parsed.textScale === "sm" || parsed.textScale === "lg" ? parsed.textScale : "md";
    const theme = parsed.theme === "dark" ? "dark" : "light";
    return { textScale, highContrast: Boolean(parsed.highContrast), theme };
  } catch {
    return { textScale: "md", highContrast: false, theme: "light" };
  }
}

export function PortalPrefsProvider({ children }: { children: ReactNode }) {
  const [textScale, setTextScaleState] = useState<TextScale>("md");
  const [highContrast, setHighContrast] = useState(false);
  const [theme, setTheme] = useState<PortalTheme>("light");

  useEffect(() => {
    const stored = readStored();
    setTextScaleState(stored.textScale);
    setHighContrast(stored.highContrast);
    setTheme(stored.theme);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset["textScale"] = textScale;
    root.classList.toggle("high-contrast", highContrast);
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ textScale, highContrast, theme }));
  }, [textScale, highContrast, theme]);

  return (
    <PrefsContext.Provider
      value={{
        textScale,
        highContrast,
        theme,
        setTextScale: setTextScaleState,
        setTheme,
        toggleHighContrast: () => setHighContrast((value) => !value),
        toggleTheme: () => setTheme((value) => (value === "light" ? "dark" : "light")),
      }}
    >
      {children}
    </PrefsContext.Provider>
  );
}

export function usePortalPrefs() {
  const context = useContext(PrefsContext);
  if (!context) throw new Error("PortalPrefsProvider missing");
  return context;
}
