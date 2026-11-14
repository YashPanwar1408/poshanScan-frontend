/**
 * Supervisor Login Page
 * Split layout: left ink panel with animated nodes + right form card.
 */
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import {
  Eye,
  EyeSlash,
  Warning,
  ArrowRight,
  Broadcast,
  ChartLineUp,
  MapTrifold,
} from "@phosphor-icons/react";
import { supervisorLogin } from "../api/client";
import { useSvAuth, buildSession } from "../store/auth";
import { isSessionValid } from "../store/auth";
import "../styles/tokens.css";

// ── Schema ───────────────────────────────────────────────────────────────────

const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Phone number or admin ID is required"),
  password: z.string().min(1, "Password is required").max(200),
});
type LoginForm = z.infer<typeof loginSchema>;

// ── Ambient animation canvas ─────────────────────────────────────────────────

function AmbientCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    type Node = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      r: number;
      color: string;
      phase: number;
      speed: number;
    };

    const COLORS = [
      "rgba(46,145,98,", // normal-ish teal-green
      "rgba(224,161,38,", // MAM amber
      "rgba(208,70,59,", // SAM red
      "rgba(15,107,92,", // primary teal
    ];

    function resize() {
      if (!canvas) return;
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }
    resize();

    const nodes: Node[] = Array.from({ length: 22 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      r: 2 + Math.random() * 3,
      color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
      phase: Math.random() * Math.PI * 2,
      speed: 0.3 + Math.random() * 0.6,
    }));

    let t = 0;
    function draw() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // dot grid
      ctx.fillStyle = "rgba(255,255,255,0.04)";
      const step = 28;
      for (let gx = 0; gx < canvas.width; gx += step) {
        for (let gy = 0; gy < canvas.height; gy += step) {
          ctx.beginPath();
          ctx.arc(gx, gy, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // draw edges between nearby nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i]!;
          const b = nodes[j]!;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            const alpha = (1 - dist / 120) * 0.12;
            ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      // draw nodes
      for (const node of nodes) {
        const pulse = Math.sin(t * node.speed + node.phase);
        const alpha = 0.25 + 0.35 * ((pulse + 1) / 2);
        const radius = node.r * (1 + 0.3 * ((pulse + 1) / 2));

        // glow
        const grd = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, radius * 4);
        grd.addColorStop(0, node.color + `${alpha})`);
        grd.addColorStop(1, node.color + "0)");
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius * 4, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();

        // core dot
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = node.color + `${Math.min(alpha + 0.3, 0.85)})`;
        ctx.fill();

        // move
        node.x += node.vx;
        node.y += node.vy;
        if (node.x < 0 || node.x > canvas.width) node.vx *= -1;
        if (node.y < 0 || node.y > canvas.height) node.vy *= -1;
      }

      t += 0.018;
      rafRef.current = requestAnimationFrame(draw);
    }

    draw();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />;
}

// ── Capabilities ──────────────────────────────────────────────────────────────

const CAPABILITIES = [
  {
    icon: <Broadcast size={16} weight="duotone" />,
    text: "Live screening feed from all field workers",
  },
  {
    icon: <ChartLineUp size={16} weight="duotone" />,
    text: "Trend analysis across districts and time",
  },
  {
    icon: <MapTrifold size={16} weight="duotone" />,
    text: "Geographic risk mapping and flagged-case review",
  },
];

// ── Main component ────────────────────────────────────────────────────────────

export function SupervisorLoginPage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { expired?: string; from?: string };
  const { setSession, session } = useSvAuth();

  const [showPw, setShowPw] = useState(false);
  const [apiError, setApiError] = useState<{
    status?: number;
    message: string;
  } | null>(null);

  // Redirect if already logged in
  useEffect(() => {
    if (isSessionValid(session)) {
      void navigate({ to: "/supervisor/overview", replace: true });
    }
  }, [session, navigate]);

  const {
    register,
    handleSubmit,
    setValue,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(data: LoginForm) {
    setApiError(null);
    try {
      const res = await supervisorLogin(data.identifier, data.password);
      const built = buildSession(res.access_token, res.role, res.name, res.user_id);
      if (!built) {
        setApiError({
          status: 403,
          message:
            "This portal is for supervisors and administrators. Field workers should use the Worker login.",
        });
        return;
      }
      setSession(built);
      const rawDest = search.from ? decodeURIComponent(search.from) : "/supervisor/overview";
      const isInvalidDest =
        !rawDest.startsWith("/") ||
        rawDest.startsWith("//") ||
        rawDest.includes("/supervisor/login") ||
        rawDest.includes("/worker/login");
      const dest = isInvalidDest ? "/supervisor/overview" : rawDest;
      if (dest.includes("?")) {
        const [path, qs] = dest.split("?");
        const params = Object.fromEntries(new URLSearchParams(qs).entries());
        await navigate({
          to: path as "/supervisor/overview",
          search: params as Record<string, string>,
          replace: true,
        });
      } else {
        await navigate({ to: dest as "/supervisor/overview", replace: true });
      }
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      if (e.status === 401) {
        setApiError({ status: 401, message: "Incorrect ID or password." });
        setFocus("identifier");
      } else if (e.status === 403) {
        setApiError({
          status: 403,
          message:
            "This portal is for supervisors and administrators. Field workers should use the Worker login.",
        });
      } else if (e.status === 0) {
        setApiError({
          status: 0,
          message: "Can't reach the server. Check your connection and try again.",
        });
      } else {
        setApiError({ message: e.message ?? "An unexpected error occurred." });
      }
    }
  }

  return (
    <div className="sv-root flex min-h-screen" style={{ background: "var(--sv-canvas)" }}>
      {/* ── Left ink panel ──────────────────────────────── */}
      <div
        className="relative hidden flex-col justify-between overflow-hidden p-10 lg:flex lg:w-[45%]"
        style={{ background: "var(--sv-ink)" }}
      >
        <AmbientCanvas />

        <div className="relative z-10">
          {/* Logo */}
          <Link
            to="/"
            className="group inline-flex items-center gap-2.5 transition-opacity hover:opacity-90"
            title="Return to PoshanScan Home"
          >
            <svg
              viewBox="0 0 32 32"
              className="size-8 shrink-0 text-[var(--sv-primary)] transition-transform group-hover:scale-105"
              aria-hidden
            >
              <rect width="32" height="32" fill="currentColor" />
              <polyline
                points="3.5 16 8 16 11.2 9 16 23 19.5 16 28.5 16"
                fill="none"
                stroke="#0A1B17"
                strokeWidth="2"
                strokeLinejoin="miter"
                strokeLinecap="square"
              />
            </svg>
            <span
              className="text-[1.05rem] font-semibold tracking-tight text-white transition-colors group-hover:text-[var(--sv-primary)]"
              style={{ fontFamily: "var(--sv-font-display)" }}
            >
              PoshanScan
            </span>
          </Link>

          <div className="mt-14">
            <p className="sv-eyebrow" style={{ color: "var(--sv-primary)" }}>
              Supervisor Portal
            </p>
            <h1
              className="mt-3 text-3xl font-semibold leading-snug text-white"
              style={{ fontFamily: "var(--sv-font-display)" }}
            >
              Programme oversight,
              <br />
              in one place.
            </h1>

            <ul className="mt-8 space-y-3">
              {CAPABILITIES.map((cap) => (
                <li
                  key={cap.text}
                  className="flex items-center gap-3 text-sm"
                  style={{ color: "var(--sv-ink-text)" }}
                >
                  <span className="shrink-0" style={{ color: "var(--sv-primary)" }}>
                    {cap.icon}
                  </span>
                  {cap.text}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div
          className="relative z-10 border-t pt-5 text-xs"
          style={{
            borderColor: "var(--sv-ink-border)",
            color: "var(--sv-ink-muted)",
          }}
        >
          Screening aid — not a diagnosis. Always confirm with a trained health worker.
        </div>
      </div>

      {/* ── Right form card ─────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        {/* Mobile logo */}
        <Link
          to="/"
          className="group mb-8 flex items-center gap-2 transition-opacity hover:opacity-90 lg:hidden"
          title="Return to PoshanScan Home"
        >
          <svg
            viewBox="0 0 32 32"
            className="size-7 text-[var(--sv-primary)] transition-transform group-hover:scale-105"
            aria-hidden
          >
            <rect width="32" height="32" fill="currentColor" />
            <polyline
              points="3.5 16 8 16 11.2 9 16 23 19.5 16 28.5 16"
              fill="none"
              stroke="#FAF9F6"
              strokeWidth="2"
              strokeLinejoin="miter"
              strokeLinecap="square"
            />
          </svg>
          <span
            className="text-lg font-semibold tracking-tight transition-colors group-hover:text-[var(--sv-primary)]"
            style={{ fontFamily: "var(--sv-font-display)" }}
          >
            PoshanScan
          </span>
        </Link>

        <div
          className="w-full max-w-md rounded-xl p-8 shadow-[var(--sv-shadow-md)]"
          style={{ background: "var(--sv-surface)", border: "1px solid var(--sv-border)" }}
        >
          {/* Session expired notice */}
          {search.expired === "1" && !apiError && (
            <div
              className="mb-5 flex items-start gap-2.5 rounded-lg px-4 py-3 text-sm"
              style={{
                background: "var(--sv-mam-sf)",
                color: "var(--sv-mam)",
                border: "1px solid color-mix(in srgb, var(--sv-mam) 25%, transparent)",
              }}
              role="status"
            >
              <Warning size={16} weight="fill" className="mt-0.5 shrink-0" />
              Your session has expired. Please sign in again.
            </div>
          )}

          <p className="sv-eyebrow">Supervisor Portal</p>
          <h2
            className="mt-2 text-2xl font-semibold text-[var(--sv-text)]"
            style={{ fontFamily: "var(--sv-font-display)" }}
          >
            Sign in
          </h2>
          <p className="mt-1 text-sm text-[var(--sv-muted)]">
            Phone number or admin ID, plus your password.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-7 space-y-4">
            {/* Identifier field */}
            <div>
              <label
                htmlFor="sv-identifier"
                className="mb-1.5 block text-xs font-semibold text-[var(--sv-text)]"
              >
                Phone number or admin ID
              </label>
              <input
                id="sv-identifier"
                type="text"
                autoComplete="username"
                inputMode="tel"
                placeholder="e.g. 9000000000 or admin"
                {...register("identifier")}
                aria-invalid={!!errors.identifier}
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors focus:ring-2"
                style={{
                  background: "var(--sv-canvas)",
                  borderColor: errors.identifier ? "var(--sv-sam)" : "var(--sv-border)",
                  color: "var(--sv-text)",
                  // @ts-expect-error CSS custom props
                  "--tw-ring-color": "var(--sv-primary)",
                }}
              />
              {errors.identifier && (
                <p className="mt-1 text-xs text-[var(--sv-sam)]" role="alert">
                  {errors.identifier.message}
                </p>
              )}
            </div>

            {/* Password field */}
            <div>
              <label
                htmlFor="sv-password"
                className="mb-1.5 block text-xs font-semibold text-[var(--sv-text)]"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="sv-password"
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  {...register("password")}
                  aria-invalid={!!errors.password}
                  className="w-full rounded-lg border px-3 py-2.5 pr-10 text-sm outline-none transition-colors focus:ring-2"
                  style={{
                    background: "var(--sv-canvas)",
                    borderColor: errors.password ? "var(--sv-sam)" : "var(--sv-border)",
                    color: "var(--sv-text)",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--sv-muted)] hover:text-[var(--sv-text)]"
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? <EyeSlash size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-[var(--sv-sam)]" role="alert">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* API error */}
            {apiError && (
              <div
                className="flex items-start gap-2.5 rounded-lg px-4 py-3 text-sm"
                style={{
                  background: "var(--sv-sam-sf)",
                  color: "var(--sv-sam)",
                  border: "1px solid color-mix(in srgb, var(--sv-sam) 25%, transparent)",
                }}
                role="alert"
              >
                <Warning size={15} weight="fill" className="mt-0.5 shrink-0" />
                <span>
                  {apiError.message}
                  {apiError.status === 403 && (
                    <>
                      {" "}
                      <Link
                        to="/worker/login"
                        className="font-semibold underline underline-offset-2"
                      >
                        Worker login
                      </Link>
                    </>
                  )}
                  {apiError.status === 0 && (
                    <div className="mt-2">
                      <button type="submit" className="font-semibold underline underline-offset-2">
                        Retry Connection
                      </button>
                    </div>
                  )}
                </span>
              </div>
            )}

            {/* Submit */}
            <button
              id="sv-signin-btn"
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-white transition-all"
              style={{
                background: isSubmitting
                  ? "color-mix(in srgb, var(--sv-primary) 70%, transparent)"
                  : "var(--sv-primary)",
              }}
            >
              {isSubmitting ? (
                <>
                  <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Signing in…
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight size={15} weight="bold" />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-[var(--sv-muted)]">
            Field worker?{" "}
            <Link
              to="/worker/login"
              className="font-medium text-[var(--sv-primary)] hover:underline"
            >
              Use the Worker login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
