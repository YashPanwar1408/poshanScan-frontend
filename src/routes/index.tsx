import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Check,
  Download,
  ScanLine,
  ShieldCheck,
  Smartphone,
  Database,
  Ruler,
} from "lucide-react";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import pose1 from "@/assets/marker placement pose 1.png";
import pose2 from "@/assets/marker placement pose 2.png";
import marker from "@/assets/aruco-marker.png";
import poshanscan_logo from "@/assets/poshanscan_logo.png";
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PoshanScan — A clearer picture of child nutrition" },
      {
        name: "description",
        content:
          "AI-assisted smartphone MUAC screening for child malnutrition, with consistent results and digital follow-up.",
      },
      { property: "og:title", content: "PoshanScan — A clearer picture of child nutrition" },
      {
        property: "og:description",
        content:
          "AI-assisted smartphone MUAC screening for child malnutrition, with consistent results and digital follow-up.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});
function Landing() {
  return (
    <div className="bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
          <Brand />
          <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
            <a href="#how-it-works" className="hover:text-primary">
              How it works
            </a>
            <a href="#try-it" className="hover:text-primary">
              Try it yourself
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link to="/worker/login">Worker login <ArrowRight size={15} /></Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/supervisor/login">Supervisor login</Link>
            </Button>
          </div>
        </div>
      </header>
      <main>
        <section className="relative overflow-hidden border-b border-border bg-hero">
          <div className="mx-auto grid min-h-[620px] max-w-7xl items-center gap-12 px-6 py-16 lg:grid-cols-[1.05fr_.95fr] lg:px-10">
            <div className="relative z-10 max-w-2xl">
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-semibold uppercase text-primary">
                <span className="size-1.5 rounded-full bg-primary" />A new perspective on nutrition
                screening
              </div>
              <h1 className="font-display text-5xl font-semibold leading-[1.1] md:text-6xl lg:text-7xl">
                A clearer picture of <em className="font-normal text-primary">child nutrition.</em>
              </h1>
              <p className="mt-7 max-w-xl text-lg leading-relaxed text-muted-foreground">
                Estimate mid-upper arm circumference from a smartphone photo. Faster, more
                consistent malnutrition screening — with every result digitally tracked for better
                follow-up.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link to="/worker/login">
                    Login as Worker <ArrowRight />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/supervisor/login">Supervisor login</Link>
                </Button>
              </div>
              <div className="mt-12 flex items-center gap-3 border-t border-border pt-6 text-sm text-muted-foreground">
                <ShieldCheck className="text-primary" size={19} />
                <span>Designed to support health workers, not replace them.</span>
              </div>
            </div>
            <div className="relative mx-auto w-full max-w-[550px]">
              <div className="relative overflow-hidden rounded-md bg-secondary">
                <img
                  src={poshanscan_logo}
                  alt="Upper arm with printed reference marker placed for a smartphone screening"
                  className="aspect-[4/4.4] w-full object-cover object-center"
                />
                <div className="absolute inset-0 border-[12px] border-secondary/20" />
              </div>
              <div className="relative bottom-1 mt-2 flex items-center justify-between rounded-md border border-border bg-card/95 px-2 py-2 shadow-lg backdrop-blur-sm">
                <div>
                  <div className="text-xs  font-semibold uppercase text-muted-foreground">
                    Capture guidance
                  </div>
                  <div className="mt-1 font-medium">Arm and marker in frame</div>
                </div>
                <span className="flex size-10 items-center justify-center rounded-full bg-success-soft text-success">
                  <Check size={21} />
                </span>
              </div>
            </div>
          </div>
        </section>
        <section className="border-b border-border py-20">
          <div className="mx-auto grid max-w-7xl gap-12 px-6 lg:grid-cols-2 lg:gap-24 lg:px-10">
            <div>
              <p className="eyebrow">THE CHALLENGE</p>
              <h2 className="mt-4 font-display text-4xl font-semibold">
                Good care starts with a measurement you can trust.
              </h2>
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="border-l-2 border-border pl-5">
                <span className="text-sm font-semibold text-muted-foreground">TODAY</span>
                <h3 className="mt-3 text-xl font-semibold">Manual & fragmented</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Tape measurements can vary between workers. Paper records make trends and
                  follow-up difficult to see.
                </p>
              </div>
              <div className="border-l-2 border-primary pl-5">
                <span className="text-sm font-semibold text-primary">WITH POSHANSCAN</span>
                <h3 className="mt-3 text-xl font-semibold">Consistent & connected</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Guided photo capture gives an estimated MUAC and risk band, with results available
                  for digital review.
                </p>
              </div>
            </div>
          </div>
        </section>
        <section id="how-it-works" className="bg-secondary/60 py-24">
          <div className="mx-auto max-w-7xl px-6 lg:px-10">
            <p className="eyebrow">THE PROCESS</p>
            <div className="mt-4 flex flex-wrap items-end justify-between gap-6">
              <h2 className="max-w-xl font-display text-4xl font-semibold">
                From photo to insight, in four simple steps.
              </h2>
              <span className="text-sm text-muted-foreground">
                Built for the realities of fieldwork.
              </span>
            </div>
            <div className="mt-12 grid gap-px overflow-hidden rounded-md border border-border bg-border md:grid-cols-4">
              {[
                {
                  icon: Smartphone,
                  title: "Capture",
                  text: "Frame the upper arm and printed marker with your phone.",
                },
                {
                  icon: ScanLine,
                  title: "Analyze",
                  text: "Image analysis estimates mid-upper arm circumference.",
                },
                {
                  icon: Ruler,
                  title: "Understand",
                  text: "See the estimated MUAC and nutritional risk band.",
                },
                {
                  icon: Database,
                  title: "Follow up",
                  text: "Screening records connect to the supervisor dashboard.",
                },
              ].map((s, i) => (
                <div key={s.title} className="bg-card p-7">
                  <div className="flex items-start justify-between">
                    <s.icon className="text-primary" size={26} />
                    <span className="font-mono text-xs text-muted-foreground">0{i + 1}</span>
                  </div>
                  <h3 className="mt-12 text-xl font-semibold">{s.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section id="try-it" className="py-24">
          <div className="mx-auto max-w-7xl px-6 lg:px-10">
            <p className="eyebrow">TRY IT YOURSELF</p>
            <h2 className="mt-4 max-w-2xl font-display text-4xl font-semibold">
              A simple guide to your first screening.
            </h2>
            <p className="mt-4 max-w-xl text-muted-foreground">
              A printed reference marker helps the camera understand scale. Follow these steps
              carefully for a clear capture.
            </p>
            <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  title: "Print the marker",
                  body: (
                    <>
                      Print it at actual size, not “fit to page”.{" "}
                      <a
                        className="font-semibold text-primary underline underline-offset-4"
                        href="https://drive.google.com/file/d/1A3BKJ6Iqz1xHca9CYWf5gLOoa2WCKT5e/view?usp=sharing"
                      >
                        Download it here <Download className="inline" size={14} />
                      </a>{" "}
                      When printing, set your printer to “Actual Size” / 100% scale — not “Fit to
                      page.”
                    </>
                  ),
                  extra: (
                    <div className="mt-5 flex items-center gap-4 rounded-md border border-border bg-secondary/40 p-3">
                      <img
                        src={marker}
                        className="size-20 border border-border object-contain"
                        alt="Printable ArUco reference marker"
                      />
                      <span className="text-xs text-muted-foreground">
                        Printable reference marker
                        <br />
                        50 mm target size
                      </span>
                    </div>
                  ),
                },
                {
                  title: "Cut it out carefully",
                  body: "Cut along the outer white border only, keeping a small white margin.",
                },
                {
                  title: "Measure your print and confirm the size",
                  body: "It should be 50mm. If different, you’ll enter the real measured size in the app.",
                },
                {
                  title: "Stick the marker on your arm",
                  body: "In the middle of your upper arm, halfway between shoulder and elbow. Keep it flat, no wrinkles.",
                },
                {
                  title: "Pose like this and take the photo",
                  body: "Arm relaxed at your side, marker facing the camera, good even lighting.",
                  extra: (
                    <div className="mt-5 grid grid-cols-2 gap-2">
                      <figure>
                        <img
                          src={pose1}
                          className="aspect-square w-full rounded-sm object-cover"
                          alt="First reference pose with marker on upper arm"
                        />
                        <figcaption className="mt-1 text-[11px] text-muted-foreground">
                          marker placement pose 1
                        </figcaption>
                      </figure>
                      <figure>
                        <img
                          src={pose2}
                          className="aspect-square w-full rounded-sm object-cover"
                          alt="Second reference pose with marker on upper arm"
                        />
                        <figcaption className="mt-1 text-[11px] text-muted-foreground">
                          marker placement pose 2
                        </figcaption>
                      </figure>
                    </div>
                  ),
                },
                {
                  title: "Upload and check your result",
                  body: "Get an instant estimated measurement and risk band.",
                },
              ].map((step, i) => (
                <article key={step.title} className="rounded-md border border-border bg-card p-6">
                  <span className="font-mono text-sm font-semibold text-primary">
                    {String(i + 1).padStart(2, "0")} / 06
                  </span>
                  <h3 className="mt-6 text-lg font-semibold">{step.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                  {step.extra}
                </article>
              ))}
            </div>
          </div>
        </section>
        <section className="bg-primary py-16 text-primary-foreground">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-7 px-6 lg:px-10">
            <div>
              <h2 className="font-display text-3xl font-semibold">
                Ready to make every screening count?
              </h2>
              <p className="mt-2 text-primary-foreground/75">
                Sign in to start screening or review your program’s progress.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="secondary" size="lg">
                <Link to="/worker/login">Worker login <ArrowRight /></Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10">
                <Link to="/supervisor/login">Supervisor login</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t border-border py-10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-start justify-between gap-8 px-6 lg:px-10">
          <div>
            <Brand />
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
              PoshanScan is a screening aid, not a medical diagnosis. Always confirm results with a
              trained health worker.
            </p>
          </div>
          <span className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} PoshanScan
          </span>
        </div>
      </footer>
    </div>
  );
}
