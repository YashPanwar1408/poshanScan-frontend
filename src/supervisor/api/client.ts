import axios, { type AxiosInstance } from "axios";
import { useNavigate } from "@tanstack/react-router";

export const API_BASE =
  (import.meta.env["VITE_API_BASE_URL"] as string | undefined) ||
  "https://poshanscan-backend.onrender.com";

/** Normalised error for the entire supervisor portal */
export interface ApiError {
  status: number;
  message: string;
  detail: string | unknown[];
}

function parseApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status ?? 0;
    const data = error.response?.data as
      { detail?: string | unknown[]; message?: string } | undefined;
    const detail = data?.detail ?? error.message;
    const message =
      typeof detail === "string" ? detail : (data?.message ?? error.message ?? "Unknown error");
    return { status, message, detail };
  }
  const msg = error instanceof Error ? error.message : "An unexpected error occurred";
  return { status: 0, message: msg, detail: msg };
}

export { parseApiError };

export type ApiStatus = "online" | "slow" | "offline";

export interface ApiHealthState {
  status: ApiStatus;
  latencyMs: number | null;
  lastChecked: number | null;
}

type HealthListener = (state: ApiHealthState) => void;
const healthListeners = new Set<HealthListener>();

let currentHealth: ApiHealthState = {
  status: "online",
  latencyMs: null,
  lastChecked: null,
};

export function subscribeApiHealth(listener: HealthListener): () => void {
  healthListeners.add(listener);
  listener(currentHealth);
  return () => healthListeners.delete(listener);
}

function updateHealth(status: ApiStatus, latencyMs: number) {
  currentHealth = { status, latencyMs, lastChecked: Date.now() };
  healthListeners.forEach((l) => l(currentHealth));
}

/** Supervisor axios client — attaches Bearer token, normalises errors */
export function getStoredSvToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("sv_session");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      token?: string;
      state?: { session?: { token?: string } };
    };
    if (typeof parsed?.state?.session?.token === "string" && parsed.state.session.token) {
      return parsed.state.session.token;
    }
    if (typeof parsed?.token === "string" && parsed.token) {
      return parsed.token;
    }
    return null;
  } catch {
    return null;
  }
}

/** Supervisor axios client — attaches Bearer token, normalises errors */
export function createSupervisorClient(): AxiosInstance {
  const client = axios.create({
    baseURL: API_BASE,
    timeout: 30_000,
  });

  // Attach Bearer token from supervisor session
  client.interceptors.request.use((config) => {
    const token = getStoredSvToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Record start time for latency tracking
    (config as typeof config & { _t?: number })._t = Date.now();
    return config;
  });

  // Record latency and notify health subscribers
  client.interceptors.response.use(
    (response) => {
      const start = (response.config as { _t?: number })._t;
      if (start) {
        const ms = Date.now() - start;
        updateHealth(ms > 1200 ? "slow" : "online", ms);
      }
      return response;
    },
    (error: unknown) => {
      const config = axios.isAxiosError(error) ? error.config : undefined;
      const start = (config as { _t?: number } | undefined)?._t;
      const ms = start ? Date.now() - start : 0;
      const status = axios.isAxiosError(error) ? (error.response?.status ?? 0) : 0;
      if (status === 0 || status >= 500) {
        updateHealth("offline", ms);
      } else {
        updateHealth(ms > 1200 ? "slow" : "online", ms);
      }

      if (axios.isAxiosError(error) && error.response?.status === 401) {
        const url = config?.url ?? "";
        const isAuthRequest = url.includes("/supervisor/login") || url.includes("/login");
        const isLoginPage =
          typeof window !== "undefined" &&
          window.location.pathname.startsWith("/supervisor/login");

        // Never force a hard page reload if this is the login call or user is already on the login page
        if (!isAuthRequest && !isLoginPage && typeof window !== "undefined") {
          localStorage.removeItem("sv_session");
          const intended = encodeURIComponent(window.location.pathname + window.location.search);
          window.location.href = `/supervisor/login?expired=1&from=${intended}`;
        }
      }
      return Promise.reject(parseApiError(error));
    },
  );

  return client;
}

export const svClient = createSupervisorClient();

/** Helper: call supervisor login endpoint */
export async function supervisorLogin(
  identifier: string,
  password: string,
): Promise<{ access_token: string; role: string; user_id?: string; name?: string }> {
  const { data } = await svClient.post("/supervisor/login", {
    phone: identifier,
    username: identifier,
    identifier,
    password,
  });
  return data as { access_token: string; role: string; user_id?: string; name?: string };
}

/** Helper: download CSV export */
export async function downloadExport(ageCategory: string): Promise<void> {
  const token = getStoredSvToken();
  const url = `${API_BASE}/supervisor/dashboard/export?age_category=${ageCategory}`;
  const a = document.createElement("a");
  a.href = url;
  a.setAttribute("download", `poshanscan-export-${new Date().toISOString().slice(0, 10)}.csv`);
  if (token) {
    // fetch as blob to attach auth header
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob = await res.blob();
    a.href = URL.createObjectURL(blob);
  }
  document.body.appendChild(a);
  a.click();
  a.remove();
}
