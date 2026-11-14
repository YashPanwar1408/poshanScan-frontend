/**
 * Supervisor UI preferences store — Zustand + localStorage.
 * Tracks sidebar collapse state, theme, and age filter.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AgeCategory } from "../api/schemas";

type SvTheme = "light" | "dark";

interface SvPrefsState {
  theme: SvTheme;
  sidebarCollapsed: boolean;
  ageCategory: AgeCategory;
  setTheme: (t: SvTheme) => void;
  toggleTheme: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  toggleSidebar: () => void;
  setAgeCategory: (a: AgeCategory) => void;
}

export const useSvPrefs = create<SvPrefsState>()(
  persist(
    (set) => ({
      theme: "light" as SvTheme,
      sidebarCollapsed: false,
      ageCategory: "all" as AgeCategory,
      setTheme: (t) => set({ theme: t }),
      toggleTheme: () => set((s) => ({ theme: s.theme === "light" ? "dark" : "light" })),
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setAgeCategory: (a) => set({ ageCategory: a }),
    }),
    {
      name: "sv_prefs",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
