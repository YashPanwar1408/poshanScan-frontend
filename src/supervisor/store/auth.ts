/**
 * Supervisor session store — Zustand + localStorage persistence.
 * Only supervisor/admin roles are ever stored here.
 * Worker sessions use the worker flow's auth in src/lib/auth.tsx (read-only).
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useQueryClient } from "@tanstack/react-query";

export type SvRole = "supervisor" | "admin";

export interface SvSession {
  token: string;
  role: SvRole;
  name: string;
  userId: string;
  /** Unix epoch ms; null means session-only (no JWT exp) */
  expiresAt: number | null;
}

interface SvAuthState {
  session: SvSession | null;
  setSession: (s: SvSession) => void;
  clearSession: () => void;
}

/** Decode JWT exp field without a library */
function decodeJwtExp(token: string): number | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64 = parts[1]!.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const payload = JSON.parse(atob(padded)) as { exp?: number };
    return payload.exp ? payload.exp * 1000 : null; // convert to ms
  } catch {
    return null;
  }
}

export function buildSession(
  token: string,
  role: string,
  name?: string,
  userId?: string,
): SvSession | null {
  const normalRole = role === "admin" ? "admin" : role === "supervisor" ? "supervisor" : null;
  if (!normalRole) return null; // worker or unknown → reject
  return {
    token,
    role: normalRole,
    name: name ?? (normalRole === "admin" ? "Administrator" : "Supervisor"),
    userId: userId ?? "—",
    expiresAt: decodeJwtExp(token),
  };
}

export const useSvAuth = create<SvAuthState>()(
  persist(
    (set) => ({
      session: null,
      setSession: (s) => set({ session: s }),
      clearSession: () => set({ session: null }),
    }),
    {
      name: "sv_session",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

/** Returns true if session exists and is not expired */
export function isSessionValid(session: SvSession | null): boolean {
  if (!session) return false;
  if (session.expiresAt == null) return true; // session-only, treat as valid
  return Date.now() < session.expiresAt;
}

/** Hook that also clears the query cache on logout */
export function useSvLogout() {
  const { clearSession } = useSvAuth();
  const qc = useQueryClient();

  return () => {
    void qc.cancelQueries().then(() => qc.clear());
    clearSession();
  };
}
