import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, ClipboardList, LockKeyhole, Phone, Users } from "lucide-react";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { errorMessage, loginSchema } from "@/lib/api";

type LoginRole = "worker" | "supervisor";

const roleCopy = {
  worker: {
    eyebrow: "FIELD WORKER ACCESS",
    title: "Log in as a worker",
    description: "Start guided screenings, capture photos, and follow up with children.",
    submit: "Open worker workspace",
    help: "Worker access is provided by your program administrator.",
    panelTitle: "Capture clearly. Screen consistently. Support better care.",
    panelDescription: "Use guided photo capture to record reliable screening information in the field.",
    nextStep: "Start a screening",
    alternate: "Supervisor login",
    alternateTo: "/supervisor/login" as const,
    icon: Phone,
  },
  supervisor: {
    eyebrow: "PROGRAM SUPERVISOR ACCESS",
    title: "Log in as a supervisor",
    description: "Review program progress, spot follow-up needs, and support your field team.",
    submit: "Open supervisor dashboard",
    help: "Supervisor access is managed by your program administrator.",
    panelTitle: "See program progress. Coordinate timely follow-up.",
    panelDescription: "Review screening trends and help field teams connect children with the right care.",
    nextStep: "Review program activity",
    alternate: "Worker login",
    alternateTo: "/worker/login" as const,
    icon: ClipboardList,
  },
} satisfies Record<LoginRole, object>;

export function RoleLogin({ role }: { role: LoginRole }) {
  const copy = roleCopy[role];
  const { login } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const checked = loginSchema.safeParse({ phone, password });
    if (!checked.success) {
      setError(checked.error.issues[0]?.message || "Please check your details.");
      return;
    }

    setBusy(true);
    try {
      const user = await login(checked.data.phone, checked.data.password);
      if (user.role !== role) {
        setError(`This account is not a ${role} account. Please use the ${user.role} login.`);
        return;
      }
      navigate({ to: role === "worker" ? "/app/scan" : "/supervisor/login", replace: true });
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  const RoleIcon = role === "worker" ? Phone : Users;

  return (
    <div className={`role-login role-login-${role} grid min-h-screen lg:grid-cols-2`}>
      <div className="flex flex-col px-6 py-7 sm:px-12 lg:px-20">
        <Brand />
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12">
          <Link to="/" className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">
            <ArrowLeft size={16} /> Back to home
          </Link>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1 className="mt-3 font-display text-4xl font-semibold">{copy.title}</h1>
          <p className="mt-3 text-muted-foreground">{copy.description}</p>

          <form onSubmit={submit} className="mt-9 space-y-5">
            <label className="block text-sm font-semibold">
              Phone number
              <div className="relative mt-2">
                <RoleIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  autoComplete="tel"
                  inputMode="tel"
                  placeholder="Enter your phone number"
                  className="field pl-12"
                />
              </div>
            </label>
            <label className="block text-sm font-semibold">
              Password
              <div className="relative mt-2">
                <LockKeyhole size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className="field pl-12"
                />
              </div>
            </label>
            {error && <p role="alert" className="rounded-md bg-danger-soft p-3 text-sm text-danger">{error}</p>}
            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy ? "Signing in…" : copy.submit} <ArrowRight />
            </Button>
          </form>

          <div className="mt-7 rounded-md border border-border bg-card p-4 text-sm">
            <p className="font-semibold">Looking for the other workspace?</p>
            <Link to={copy.alternateTo} className="mt-2 inline-flex items-center gap-2 font-medium text-primary hover:underline">
              {copy.alternate} <ArrowRight size={15} />
            </Link>
          </div>
          <p className="mt-6 text-center text-xs text-muted-foreground">{copy.help}</p>
        </div>
      </div>

      <aside className="relative hidden overflow-hidden bg-primary lg:block">
        <div className="absolute inset-0 flex flex-col justify-end p-16 text-primary-foreground">
          <div className="mb-7 flex size-16 items-center justify-center rounded-md bg-primary-foreground/10">
            {role === "worker" ? <LockKeyhole size={30} /> : <Users size={30} />}
          </div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-primary-foreground/70">{copy.nextStep}</p>
          <h2 className="max-w-lg font-display text-4xl font-semibold leading-tight">{copy.panelTitle}</h2>
          <p className="mt-5 max-w-md leading-relaxed text-primary-foreground/75">{copy.panelDescription}</p>
        </div>
      </aside>
    </div>
  );
}
