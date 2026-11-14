import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type TextScale = "sm" | "md" | "lg";

type PortalPrefs = {
  textScale: TextScale;
  highContrast: boolean;
  setTextScale: (scale: TextScale) => void;
  toggleHighContrast: () => void;
};

const STORAGE_KEY = "poshanscan_portal_prefs";
const PrefsContext = createContext<PortalPrefs | null>(null);

function readStored(): { textScale: TextScale; highContrast: boolean } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { textScale: "md", highContrast: false };
    const parsed = JSON.parse(raw) as { textScale?: TextScale; highContrast?: boolean };
    const textScale =
      parsed.textScale === "sm" || parsed.textScale === "lg" ? parsed.textScale : "md";
    return { textScale, highContrast: Boolean(parsed.highContrast) };
  } catch {
    return { textScale: "md", highContrast: false };
  }
}

export function PortalPrefsProvider({ children }: { children: ReactNode }) {
  const [textScale, setTextScaleState] = useState<TextScale>("md");
  const [highContrast, setHighContrast] = useState(false);

  useEffect(() => {
    const stored = readStored();
    setTextScaleState(stored.textScale);
    setHighContrast(stored.highContrast);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset["textScale"] = textScale;
    root.classList.toggle("high-contrast", highContrast);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ textScale, highContrast }));
  }, [textScale, highContrast]);

  return (
    <PrefsContext.Provider
      value={{
        textScale,
        highContrast,
        setTextScale: setTextScaleState,
        toggleHighContrast: () => setHighContrast((value) => !value),
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
