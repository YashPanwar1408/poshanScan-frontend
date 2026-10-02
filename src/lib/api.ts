import axios from "axios";
import { z } from "zod";

export const API_BASE = import.meta.env["VITE_API_BASE_URL"] || "http://localhost:8000";
export const api = axios.create({ baseURL: API_BASE, timeout: 90000 });
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("poshanscan_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const loginSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s-]{8,18}$/, "Enter a valid phone number"),
  password: z.string().min(1, "Enter your password").max(200),
});
export const childSchema = z.object({
  name: z.string().trim().min(1).max(100),
  dob: z.string().date(),
  gender: z.enum(["M", "F", "O"]),
  guardian_name: z.string().trim().min(1).max(100),
  village: z.string().trim().min(1).max(100),
});
export const authSchema = z.object({
  access_token: z.string().min(1),
  role: z.enum(["worker", "supervisor", "admin"]),
  user_id: z.string().min(1),
});
export type AuthUser = z.infer<typeof authSchema>;
export type Child = z.infer<typeof childSchema> & { id: string };
export type ScanResult = {
  scan_id: string;
  client_scan_id: string;
  child_id: string;
  muac_estimate_mm: number;
  risk_band: "NORMAL" | "MAM" | "SAM";
  confidence_score: number;
  created_at: string;
};
export function errorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 401)
      return "Your session has expired or the credentials are incorrect. Please log in again.";
    return (
      error.response?.data?.message || error.message || "Something went wrong. Please try again."
    );
  }
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}
