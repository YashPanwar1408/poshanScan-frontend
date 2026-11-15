import { useState, useEffect, useId } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "framer-motion";
import {
  Camera,
  QrCode,
  Scan,
  Compass,
  Ruler,
  ShieldCheck,
  CheckCircle,
  WarningOctagon,
  ChartLineUp,
  UserCheck,
  DeviceMobileCamera,
  CaretDown,
  Sparkle,
  LockKey,
} from "@phosphor-icons/react";

import { TEAM_MEMBERS } from "@/data/team";
import { ThemeToggle } from "@/components/ThemeToggle";

import childPoseGuide from "@/assets/child_muac_screening.jpg";
import logo from "@/assets/poshanscan_logo.png";

const MARKER_URL =
  "https://drive.google.com/file/d/1A3BKJ6Iqz1xHca9CYWf5gLOoa2WCKT5e/view?usp=sharing";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PoshanScan — Digital Screening for Child Malnutrition" },
      {
        name: "description",
        content:
          "AI-assisted Mid-Upper Arm Circumference (MUAC) screening for frontline health workers and public health supervisors. Fast, consistent, digitally connected triage.",
      },
      { property: "og:title", content: "PoshanScan — Digital Screening for Child Malnutrition" },
      {
        property: "og:description",
        content:
          "Smartphone-based MUAC screening and supervisor analytics platform for community child health.",
      },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "icon", type: "image/png", href: "/poshanscan_logo.png" }],
  }),
  component: Landing,
});

/* ── Live Scan Simulation States ── */
const SIMULATED_SCANS = [
  {
    muac: 118,
    band: "MAM",
    bandLabel: "Moderate Acute Malnutrition",
    color: "#d97706",
    bgSoft: "#fef3c7",
    action: "Supplementary feeding counselling & close monitoring (re-screen in 2–4 wks)",
  },
  {
    muac: 132,
    band: "Normal",
    bandLabel: "Adequate Nutrition (Normal)",
    color: "#0f766e",
    bgSoft: "#ccfbf1",
    action: "Continue routine community monitoring & nutritional guidance",
  },
  {
    muac: 108,
    band: "SAM",
    bandLabel: "Severe Acute Malnutrition",
    color: "#e11d48",
    bgSoft: "#ffe4e6",
    action: "Urgent referral to Nutrition Rehabilitation Centre (NRC) for clinical assessment",
  },
];

/* ── 6-Stage Measurement Pipeline ── */
const PIPELINE_STAGES = [
  {
    step: "01",
    id: "capture",
    name: "Standardized Capture",
    short: "Marker & arm alignment",
    formula: "d ≈ 30–40 cm, 90° angle",
    summary:
      "Frontline worker aligns camera perpendicular to the upper arm midpoint with printed reference marker affixed flat.",
    details:
      "Guidance overlays check for camera distance, tilt, and stability before triggering capture.",
  },
  {
    step: "02",
    id: "detection",
    name: "Marker Detection",
    short: "Sub-pixel corner detection",
    formula: "Scale = 50.0 mm / w_px",
    summary:
      "ArUco algorithm locates the 4 marker corners to compute the exact optical scale in millimeters per pixel.",
    details:
      "Compensates for perspective distortion and establishes a metric reference independent of smartphone sensor size.",
  },
  {
    step: "03",
    id: "localization",
    name: "Arm Localization",
    short: "Anatomical landmarking",
    formula: "Midpoint(Acromion, Olecranon)",
    summary:
      "Computer vision isolates the upper arm anatomy between the shoulder joint and elbow bend.",
    details: "Identifies the standard WHO MUAC measurement level (halfway point) automatically.",
  },
  {
    step: "04",
    id: "segmentation",
    name: "Contour Segmentation",
    short: "Sub-pixel edge boundary",
    formula: "Gradient-weighted limb mask",
    summary:
      "Deep semantic segmentation separates arm skin boundary from background clothing, shadows, and environment.",
    details:
      "Robust edge localization extracts the true cross-sectional silhouette width at the midpoint level.",
  },
  {
    step: "05",
    id: "geometry",
    name: "Geometric Estimation",
    short: "Calibrated ellipse model",
    formula: "MUAC ≈ π · k · w_arm (k ≈ 1.22–1.35)",
    summary:
      "Physical diameter is scaled (px × mm/px) and converted into circumference via empirically calibrated cross-section factor k.",
    details:
      "The scaling factor k (1.22–1.35) accounts for upper arm cross-sectional ellipticity evaluated rigorously against Shakir tape.",
  },
  {
    step: "06",
    id: "band",
    name: "WHO Band Triage",
    short: "Clinical triage classification",
    formula: "SAM < 115 ≤ MAM < 125 ≤ Normal",
    summary:
      "Instant assignment into WHO child screening bands: Normal (≥125 mm), MAM (115–<125 mm), and SAM (<115 mm).",
    details:
      "Provides unambiguous frontline guidance while securely streaming flagged readings to the supervisor portal.",
  },
];

/* ── FAQ items ── */
const FAQ_ITEMS = [
  {
    q: "What is Mid-Upper Arm Circumference (MUAC) and why is it used?",
    a: "MUAC is a quick, reliable indicator of muscle and fat wasting in children aged 6–59 months. It is strongly correlated with child mortality risk and is the global standard for community-level acute malnutrition screening.",
  },
  {
    q: "How does PoshanScan calculate MUAC without a physical tape measure?",
    a: "The user places a calibrated 50 mm ArUco marker on the arm. The computer vision pipeline detects the marker corners to obtain an exact scale factor (mm per pixel), segments the arm silhouette, and computes circumference using a validated geometric ellipse formula (MUAC ≈ π · k · width, where k is an empirically calibrated factor between 1.22 and 1.35).",
  },
  {
    q: "Does PoshanScan provide a medical diagnosis?",
    a: "No. PoshanScan is strictly a community triage and screening aid designed to assist frontline workers. Any child flagged as MAM or SAM must be clinically evaluated and confirmed with standard Shakir tape measurements by trained healthcare staff before medical interventions.",
  },
  {
    q: "Can frontline workers use PoshanScan in low-connectivity areas?",
    a: "Yes. The frontline worker interface is built with an offline-first architecture. Scans and initial assessments are captured locally on the device and automatically synchronized to the supervisor dashboard once connectivity is restored.",
  },
  {
    q: "How is child privacy protected?",
    a: "The platform adheres to strict data minimization. Child names are masked by default across all dashboards with a controlled reveal toggle. Only authorized supervisors have access to district triage logs, and no biometric identities are stored or sold.",
  },
];

export function Landing() {
  const shouldReduceMotion = useReducedMotion();

  // Simulation state
  const [simIndex, setSimIndex] = useState(0);
  const activeSim = SIMULATED_SCANS[simIndex] ?? SIMULATED_SCANS[0]!;

  useEffect(() => {
    const timer = setInterval(() => {
      setSimIndex((prev) => (prev + 1) % SIMULATED_SCANS.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  // 6-stage pipeline interactive selection
  const [activeStage, setActiveStage] = useState(0);

  // Band explorer slider state (80mm to 180mm)
  const [explorerMuac, setExplorerMuac] = useState(118);

  const getExplorerBand = (val: number) => {
    if (val < 115) {
      return {
        band: "SAM",
        title: "Severe Acute Malnutrition",
        tag: "High Priority · Immediate Action",
        colorText: "text-rose-600 dark:text-rose-400",
        colorBg: "bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800",
        badgeBg: "bg-rose-600 text-white",
        protocol:
          "Refer immediately to the nearest Primary Health Centre or Nutrition Rehabilitation Centre (NRC) for clinical assessment and therapeutic nutrition protocol.",
        frequency: "Immediate clinical referral · follow-up within 48 hours",
      };
    }
    if (val < 125) {
      return {
        band: "MAM",
        title: "Moderate Acute Malnutrition",
        tag: "Moderate Risk · Structured Monitoring",
        colorText: "text-amber-600 dark:text-amber-400",
        colorBg: "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800",
        badgeBg: "bg-amber-600 text-white",
        protocol:
          "Provide focused maternal and infant nutrition counselling. Guide caregiver on supplementary feeding and hygiene. Schedule repeat screening.",
        frequency: "Re-screen with tape measurement in 2 to 4 weeks",
      };
    }
    return {
      band: "Normal",
      title: "Adequate Nutrition (Normal Range)",
      tag: "Standard Growth Track",
      colorText: "text-teal-700 dark:text-teal-400",
      colorBg: "bg-teal-50 dark:bg-teal-950/40 border-teal-300 dark:border-teal-800",
      badgeBg: "bg-teal-700 text-white",
      protocol:
        "Child's arm circumference is within the expected healthy range. Continue routine immunization, growth monitoring, and age-appropriate diverse diet.",
      frequency: "Continue standard monthly community screening visit",
    };
  };

  const currentExplorer = getExplorerBand(explorerMuac);

  // Workflow tab state
  const [workflowRole, setWorkflowRole] = useState<"worker" | "supervisor">("worker");

  // FAQ accordion state
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const headingId = useId();

  return (
    <div className="min-h-screen bg-[var(--sv-bg,#FAF9F6)] text-[var(--sv-text,#1C1B19)] selection:bg-teal-600 selection:text-white">
      {/* ── Accessibility skip link ── */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-teal-800 focus:px-4 focus:py-2.5 focus:text-white focus:shadow-xl focus:ring-2 focus:ring-white"
      >
        Skip to main content
      </a>

      {/* ── Main Site Header ── */}
      <header className="sticky top-0 z-40 border-b border-[var(--sv-border,#D4D0C8)] bg-[var(--sv-bg,#FAF9F6)]/95 backdrop-blur-md">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-10">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-3.5 group">
              <img
                src={logo}
                alt="PoshanScan"
                className="h-12 w-12 object-contain transition-transform group-hover:scale-105"
                width="48"
                height="48"
              />
              <div className="hidden sm:block">
                <span className="block font-display text-xl font-bold tracking-tight text-teal-900 dark:text-teal-100">
                  PoshanScan
                </span>
                <span className="block text-[10px] uppercase tracking-widest text-[var(--sv-muted,#5C5A56)] font-semibold">
                  Child Nutrition Screening
                </span>
              </div>
            </Link>

            <nav
              className="hidden md:flex items-center gap-6 text-sm font-medium text-[var(--sv-muted,#5C5A56)]"
              aria-label="Main Navigation"
            >
              <a href="#how-it-works" className="hover:text-teal-700 transition-colors">
                How It Works
              </a>
              <a href="#band-explorer" className="hover:text-teal-700 transition-colors">
                Band Explorer
              </a>
              <a href="#workflows" className="hover:text-teal-700 transition-colors">
                Workflows
              </a>
              <a href="#privacy" className="hover:text-teal-700 transition-colors">
                Responsible Use
              </a>
              <a href="#faq" className="hover:text-teal-700 transition-colors">
                FAQ
              </a>
            </nav>
          </div>

          <div className="flex items-center gap-2.5">
            <ThemeToggle />
            <Link
              to="/worker/login"
              className="portal-btn portal-btn-outline text-xs px-3.5 py-2 font-medium"
            >
              Login as Worker
            </Link>
            <Link
              to="/supervisor/login"
              className="portal-btn portal-btn-solid text-xs px-4 py-2 font-medium bg-teal-800 hover:bg-teal-900 text-white"
            >
              Login as Supervisor
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content">
        {/* ── 1. Hero Section with Live Scan Simulation ── */}
        <section className="relative border-b border-[var(--sv-border,#D4D0C8)] py-14 lg:py-20 overflow-hidden">
          <div className="mx-auto max-w-7xl px-6 lg:px-10">
            <div className="grid items-center gap-12 lg:grid-cols-12">
              {/* Left Column: Mission & CTAs */}
              <div className="lg:col-span-7 space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold tracking-wider uppercase bg-teal-100/80 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                  <Sparkle size={14} className="text-teal-600" weight="fill" />
                  National Child Nutrition Screening Initiative
                </div>

                <h1
                  id={headingId}
                  className="font-display text-4xl sm:text-5xl lg:text-[3.25rem] font-bold tracking-tight text-[var(--sv-text,#1C1B19)] leading-[1.12]"
                >
                  Digital Screening for Frontline Child Nutrition
                </h1>

                <p className="text-base sm:text-lg text-[var(--sv-muted,#5C5A56)] leading-relaxed max-w-2xl">
                  PoshanScan estimates Mid-Upper Arm Circumference (MUAC) from a guided smartphone
                  photograph next to a standard reference marker. Designed to empower community
                  health workers with consistent, objective screening while automatically
                  synchronizing flagged cases to public health supervisors.
                </p>

                <div className="flex flex-wrap items-center gap-3.5 pt-2">
                  <Link
                    to="/worker/login"
                    className="portal-btn portal-btn-solid text-sm font-semibold px-5 py-3 bg-teal-800 hover:bg-teal-900 text-white rounded shadow-sm inline-flex items-center gap-2"
                  >
                    <DeviceMobileCamera size={18} weight="bold" />
                    Login as Worker
                  </Link>
                  <Link
                    to="/supervisor/login"
                    className="portal-btn portal-btn-outline text-sm font-semibold px-5 py-3 border-[var(--sv-border,#D4D0C8)] text-[var(--sv-text,#1C1B19)] hover:bg-[var(--sv-surface,#FFFFFF)] rounded inline-flex items-center gap-2"
                  >
                    <ChartLineUp size={18} weight="bold" />
                    Login as Supervisor
                  </Link>
                </div>

                <div className="pt-2 flex flex-wrap items-center gap-6 text-xs text-[var(--sv-muted,#5C5A56)]">
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <ShieldCheck size={16} className="text-teal-700" weight="fill" />
                    Screening aid, not a diagnosis
                  </span>
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <CheckCircle size={16} className="text-teal-700" weight="fill" />
                    Evaluated against Shakir tape
                  </span>
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <LockKey size={16} className="text-teal-700" weight="fill" />
                    Privacy-first child triage
                  </span>
                </div>
              </div>

              {/* Right Column: Interactive Live Scan Simulation (CSS/SVG only) */}
              <div className="lg:col-span-5 relative">
                <div className="relative mx-auto max-w-md rounded-xl border border-[var(--sv-border,#D4D0C8)] bg-[var(--sv-surface,#FFFFFF)] p-3 shadow-xl">
                  {/* Smartphone Frame Simulation */}
                  <div className="relative overflow-hidden rounded-lg bg-zinc-900 aspect-[4/5] select-none">
                    <img
                      src={childPoseGuide}
                      alt="PoshanScan frontline child malnutrition screening (6–59 months) with reference marker"
                      className="h-full w-full object-cover object-center opacity-95"
                      width="400"
                      height="500"
                    />

                    {/* Camera Viewfinder Corners */}
                    <div className="absolute inset-4 pointer-events-none border border-white/20 rounded-md">
                      <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-teal-400" />
                      <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-teal-400" />
                      <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-teal-400" />
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-teal-400" />
                    </div>

                    {/* ArUco Marker Corner Tracking Box (animated) */}
                    <div className="absolute top-[56%] left-[51%] w-16 h-16 pointer-events-none -translate-x-1/2 -translate-y-1/2">
                      <div className="relative w-full h-full border border-teal-400/80 bg-teal-400/10 animate-pulse">
                        <span className="absolute -top-1 -left-1 text-[8px] font-mono text-teal-300 font-bold">
                          [+]
                        </span>
                        <span className="absolute -top-1 -right-1 text-[8px] font-mono text-teal-300 font-bold">
                          [+]
                        </span>
                        <span className="absolute -bottom-1 -left-1 text-[8px] font-mono text-teal-300 font-bold">
                          [+]
                        </span>
                        <span className="absolute -bottom-1 -right-1 text-[8px] font-mono text-teal-300 font-bold">
                          [+]
                        </span>
                        <span className="absolute -bottom-4 left-0 whitespace-nowrap bg-black/80 px-1 py-0.5 text-[8px] font-mono text-teal-300">
                          ArUco 50mm locked
                        </span>
                      </div>
                    </div>

                    {/* Animated Scanning Laser Line */}
                    <motion.div
                      className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-teal-400 to-transparent pointer-events-none shadow-[0_0_12px_#2dd4bf]"
                      animate={
                        shouldReduceMotion
                          ? {}
                          : {
                              top: ["25%", "75%", "25%"],
                            }
                      }
                      transition={{
                        duration: 3.2,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    />

                    {/* Arm Cross-section measurement line */}
                    <div className="absolute top-[58%] left-[22%] right-[28%] pointer-events-none">
                      <div className="relative border-b-2 border-dashed border-teal-300 flex items-center justify-between">
                        <div className="w-1.5 h-3 bg-teal-400 -translate-y-1/2" />
                        <div className="bg-black/80 px-2 py-0.5 rounded text-[10px] font-mono text-teal-300 -translate-y-3 font-semibold shadow">
                          w ≈ {(activeSim.muac / 3.14159 / 1.28).toFixed(1)} mm
                        </div>
                        <div className="w-1.5 h-3 bg-teal-400 -translate-y-1/2" />
                      </div>
                    </div>

                    {/* Live HUD Card (Cycling states) */}
                    <div className="absolute bottom-3 inset-x-3 rounded bg-zinc-950/90 backdrop-blur-md p-3 border border-zinc-700/80 text-white shadow-2xl">
                      <div className="flex items-center justify-between text-[11px] mb-1.5">
                        <span className="flex items-center gap-1.5 text-zinc-400 font-mono">
                          <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping inline-block" />
                          LIVE SCREENING
                        </span>
                        <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-medium">
                          Illustrative example
                        </span>
                      </div>

                      <div className="flex items-baseline justify-between">
                        <div>
                          <div className="text-2xl font-bold font-mono tracking-tight text-white">
                            {activeSim.muac}{" "}
                            <span className="text-xs font-normal text-zinc-400">mm MUAC</span>
                          </div>
                          <div
                            className="text-[11px] font-medium"
                            style={{ color: activeSim.color }}
                          >
                            {activeSim.bandLabel}
                          </div>
                        </div>

                        <div
                          className="px-2.5 py-1 rounded text-xs font-bold font-mono uppercase"
                          style={{
                            backgroundColor: activeSim.bgSoft,
                            color: activeSim.color,
                          }}
                        >
                          {activeSim.band}
                        </div>
                      </div>

                      <div className="mt-2 text-[10px] text-zinc-300 border-t border-zinc-800 pt-1.5 line-clamp-1">
                        {activeSim.action}
                      </div>
                    </div>
                  </div>

                  {/* Caption underneath phone simulation */}
                  <div className="mt-3 flex items-center justify-between text-xs text-[var(--sv-muted,#5C5A56)] px-1">
                    <span className="font-mono text-[11px]">Optical scale: 0.18 mm/px</span>
                    <span className="font-medium">Pose: Marker facing camera</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 2. "How the Measurement Works" (Interactive 6-Stage Pipeline) ── */}
        <section
          id="how-it-works"
          className="border-b border-[var(--sv-border,#D4D0C8)] py-16 lg:py-24 bg-[var(--sv-surface,#FFFFFF)]"
        >
          <div className="mx-auto max-w-7xl px-6 lg:px-10">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-wider text-teal-800 dark:text-teal-400">
                Scientific Pipeline
              </p>
              <h2 className="mt-2 font-display text-3xl sm:text-4xl font-bold tracking-tight text-[var(--sv-text,#1C1B19)]">
                From Raw Smartphone Photo to Clinical Triage
              </h2>
              <p className="mt-4 text-base text-[var(--sv-muted,#5C5A56)] leading-relaxed">
                PoshanScan turns a frontline smartphone camera into a calibrated screening
                instrument through an automated six-stage computer vision and geometric estimation
                pipeline.
              </p>
            </div>

            {/* 6 Stage Navigation */}
            <div className="mt-12 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {PIPELINE_STAGES.map((st, idx) => {
                const isSelected = activeStage === idx;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setActiveStage(idx)}
                    className={`text-left p-4 rounded-lg border transition-all ${
                      isSelected
                        ? "border-teal-700 bg-teal-50 dark:bg-teal-950/40 shadow-sm ring-1 ring-teal-700"
                        : "border-[var(--sv-border,#D4D0C8)] bg-[var(--sv-bg,#FAF9F6)] hover:bg-[var(--sv-surface,#FFFFFF)]"
                    }`}
                  >
                    <span className="block font-mono text-xs font-bold text-teal-800 dark:text-teal-400">
                      STAGE {st.step}
                    </span>
                    <span className="block mt-1 font-semibold text-sm text-[var(--sv-text,#1C1B19)]">
                      {st.name}
                    </span>
                    <span className="block mt-1 text-xs text-[var(--sv-muted,#5C5A56)] line-clamp-1">
                      {st.short}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Selected Stage Detail Panel */}
            {(() => {
              const current = PIPELINE_STAGES[activeStage] ?? PIPELINE_STAGES[0]!;
              return (
                <div className="mt-8 rounded-xl border border-[var(--sv-border,#D4D0C8)] bg-[var(--sv-bg,#FAF9F6)] p-6 lg:p-8">
                  <div className="grid gap-8 lg:grid-cols-12 items-center">
                    <div className="lg:col-span-7 space-y-4">
                      <div className="inline-flex items-center gap-2 font-mono text-xs font-semibold px-2.5 py-1 rounded bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300">
                        STAGE {current.step} OF 06 · {current.name}
                      </div>
                      <h3 className="font-display text-2xl font-bold text-[var(--sv-text,#1C1B19)]">
                        {current.name}: {current.short}
                      </h3>
                      <p className="text-base text-[var(--sv-text,#1C1B19)] leading-relaxed">
                        {current.summary}
                      </p>
                      <p className="text-sm text-[var(--sv-muted,#5C5A56)] leading-relaxed">
                        {current.details}
                      </p>

                      <div className="pt-2">
                        <div className="inline-block rounded-md bg-[var(--sv-surface,#FFFFFF)] border border-[var(--sv-border,#D4D0C8)] px-4 py-2 font-mono text-xs font-semibold text-teal-900 dark:text-teal-200">
                          {current.formula}
                        </div>
                      </div>
                    </div>

                    <div className="lg:col-span-5 flex justify-center">
                      {/* Interactive Stage Illustration Diagram */}
                      <div className="w-full max-w-sm rounded-lg border border-[var(--sv-border,#D4D0C8)] bg-[var(--sv-surface,#FFFFFF)] p-5 shadow-sm text-center">
                        {activeStage === 0 && (
                          <div className="space-y-3 py-4">
                            <Camera size={48} className="mx-auto text-teal-700" />
                            <div className="text-xs font-mono font-bold">Standard Camera Pose</div>
                            <p className="text-xs text-[var(--sv-muted,#5C5A56)]">
                              Perpendicular angle (90°), mid-arm marker level, natural indirect
                              illumination.
                            </p>
                          </div>
                        )}
                        {activeStage === 1 && (
                          <div className="space-y-3 py-4">
                            <QrCode size={48} className="mx-auto text-teal-700" />
                            <div className="text-xs font-mono font-bold">ArUco 50 mm Reference</div>
                            <p className="text-xs text-[var(--sv-muted,#5C5A56)]">
                              Detects 4 outer corners with sub-pixel refinement to establish scale
                              mm/px.
                            </p>
                          </div>
                        )}
                        {activeStage === 2 && (
                          <div className="space-y-3 py-4">
                            <Compass size={48} className="mx-auto text-teal-700" />
                            <div className="text-xs font-mono font-bold">Midpoint Localization</div>
                            <p className="text-xs text-[var(--sv-muted,#5C5A56)]">
                              Automated joint keypoints isolate the midpoint between acromion and
                              olecranon.
                            </p>
                          </div>
                        )}
                        {activeStage === 3 && (
                          <div className="space-y-3 py-4">
                            <Scan size={48} className="mx-auto text-teal-700" />
                            <div className="text-xs font-mono font-bold">
                              Limb Mask Segmentation
                            </div>
                            <p className="text-xs text-[var(--sv-muted,#5C5A56)]">
                              Removes background clothing, clutter, and shadows to isolate clean
                              limb borders.
                            </p>
                          </div>
                        )}
                        {activeStage === 4 && (
                          <div className="space-y-3 py-4">
                            <Ruler size={48} className="mx-auto text-teal-700" />
                            <div className="text-xs font-mono font-bold">
                              Geometric Ellipse Model
                            </div>
                            <p className="text-xs text-[var(--sv-muted,#5C5A56)]">
                              MUAC ≈ π · k · width. Evaluated against Shakir tape measurements (k ≈
                              1.22–1.35).
                            </p>
                          </div>
                        )}
                        {activeStage === 5 && (
                          <div className="space-y-3 py-4">
                            <ShieldCheck size={48} className="mx-auto text-teal-700" />
                            <div className="text-xs font-mono font-bold">
                              WHO Triage Classification
                            </div>
                            <p className="text-xs text-[var(--sv-muted,#5C5A56)]">
                              Instant categorization: Normal (≥125 mm), MAM (115–&lt;125 mm), SAM
                              (&lt;115 mm).
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </section>

        {/* ── 3. "Band Explorer" Interactive Slider ── */}
        <section
          id="band-explorer"
          className="border-b border-[var(--sv-border,#D4D0C8)] py-16 lg:py-24"
        >
          <div className="mx-auto max-w-7xl px-6 lg:px-10">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-wider text-teal-800 dark:text-teal-400">
                Interactive Reference
              </p>
              <h2 className="mt-2 font-display text-3xl sm:text-4xl font-bold tracking-tight text-[var(--sv-text,#1C1B19)]">
                WHO MUAC Band Explorer
              </h2>
              <p className="mt-4 text-base text-[var(--sv-muted,#5C5A56)] leading-relaxed">
                Drag the slider to test any mid-upper arm circumference from 80 mm to 180 mm.
                Observe how the clinical risk band and frontline referral guidance adapt in real
                time.
              </p>
            </div>

            <div className="mt-12 grid gap-8 lg:grid-cols-12 items-center">
              {/* Slider & Scale Visual */}
              <div className="lg:col-span-7 rounded-xl border border-[var(--sv-border,#D4D0C8)] bg-[var(--sv-surface,#FFFFFF)] p-6 lg:p-8">
                <div className="flex items-center justify-between mb-4">
                  <label
                    htmlFor="muac-slider"
                    className="text-sm font-semibold text-[var(--sv-text,#1C1B19)]"
                  >
                    Adjust Circumference (MUAC)
                  </label>
                  <div className="text-right">
                    <span className="text-3xl font-bold font-mono text-teal-900 dark:text-teal-100">
                      {explorerMuac}
                    </span>
                    <span className="text-xs font-mono text-[var(--sv-muted,#5C5A56)] ml-1">
                      mm
                    </span>
                  </div>
                </div>

                {/* Range Input */}
                <input
                  id="muac-slider"
                  type="range"
                  min="80"
                  max="180"
                  step="1"
                  value={explorerMuac}
                  onChange={(e) => setExplorerMuac(Number(e.target.value))}
                  className="w-full h-3 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-teal-700"
                />

                {/* Colored WHO Band Spectrum Bar */}
                <div className="mt-6 relative">
                  <div className="h-6 w-full rounded flex overflow-hidden text-[10px] font-bold text-white uppercase text-center select-none shadow-inner">
                    <div
                      style={{ width: "35%" }}
                      className="bg-rose-600 flex items-center justify-center"
                      title="SAM: < 115 mm"
                    >
                      SAM (&lt;115)
                    </div>
                    <div
                      style={{ width: "10%" }}
                      className="bg-amber-500 flex items-center justify-center text-zinc-900 font-extrabold"
                      title="MAM: 115 to < 125 mm"
                    >
                      MAM
                    </div>
                    <div
                      style={{ width: "55%" }}
                      className="bg-teal-700 flex items-center justify-center"
                      title="Normal: ≥ 125 mm"
                    >
                      Normal (≥125 mm)
                    </div>
                  </div>

                  {/* Slider marker pointer */}
                  <div
                    className="absolute -top-1.5 w-3 h-9 bg-zinc-900 dark:bg-white rounded border-2 border-white dark:border-zinc-900 shadow-md -translate-x-1/2 transition-all pointer-events-none"
                    style={{
                      left: `${((explorerMuac - 80) / 100) * 100}%`,
                    }}
                  />
                </div>

                <div className="mt-4 flex justify-between text-xs font-mono text-[var(--sv-muted,#5C5A56)]">
                  <span>80 mm</span>
                  <span className="font-semibold text-rose-600">115 mm (SAM cutoff)</span>
                  <span className="font-semibold text-amber-600">125 mm (MAM cutoff)</span>
                  <span>180 mm</span>
                </div>

                <div className="mt-6 border-t border-[var(--sv-border,#D4D0C8)] pt-4 text-xs text-[var(--sv-muted,#5C5A56)] leading-relaxed">
                  <span className="font-semibold text-[var(--sv-text,#1C1B19)]">
                    WHO Guideline:{" "}
                  </span>
                  Applies to children aged 6 to 59 months. MUAC provides a rapid assessment of
                  wasting without requiring height measurement in the field.
                </div>
              </div>

              {/* Dynamic Band Card */}
              <div className="lg:col-span-5">
                <div
                  className={`rounded-xl border p-6 lg:p-8 transition-all ${currentExplorer.colorBg}`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-[var(--sv-muted,#5C5A56)]">
                      WHO Screening Band
                    </span>
                    <span
                      className={`px-3 py-1 rounded text-xs font-bold font-mono ${currentExplorer.badgeBg}`}
                    >
                      {currentExplorer.band}
                    </span>
                  </div>

                  <h3 className={`font-display text-2xl font-bold ${currentExplorer.colorText}`}>
                    {currentExplorer.title}
                  </h3>

                  <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-[var(--sv-muted,#5C5A56)]">
                    {currentExplorer.tag}
                  </p>

                  <div className="mt-6 space-y-4 text-sm">
                    <div>
                      <span className="block font-semibold text-xs uppercase tracking-wide text-[var(--sv-text,#1C1B19)] mb-1">
                        Recommended Action:
                      </span>
                      <p className="leading-relaxed text-[var(--sv-text,#1C1B19)]">
                        {currentExplorer.protocol}
                      </p>
                    </div>

                    <div className="border-t border-black/10 dark:border-white/10 pt-3">
                      <span className="block font-semibold text-xs uppercase tracking-wide text-[var(--sv-text,#1C1B19)] mb-1">
                        Monitoring Protocol:
                      </span>
                      <p className="text-xs text-[var(--sv-muted,#5C5A56)]">
                        {currentExplorer.frequency}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 rounded bg-white/70 dark:bg-black/30 p-3 text-[11px] text-[var(--sv-muted,#5C5A56)] border border-black/5 dark:border-white/5">
                    <strong>Note:</strong> PoshanScan is a digital screening aid. Any child flagged
                    as SAM or MAM must be clinically verified with standard Shakir tape and assessed
                    for oedema.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 4. "Two Roles, One Workflow" ── */}
        <section
          id="workflows"
          className="border-b border-[var(--sv-border,#D4D0C8)] py-16 lg:py-24 bg-[var(--sv-surface,#FFFFFF)]"
        >
          <div className="mx-auto max-w-7xl px-6 lg:px-10">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-wider text-teal-800 dark:text-teal-400">
                Connected Operations
              </p>
              <h2 className="mt-2 font-display text-3xl sm:text-4xl font-bold tracking-tight text-[var(--sv-text,#1C1B19)]">
                Two Roles, One Connected Workflow
              </h2>
              <p className="mt-4 text-base text-[var(--sv-muted,#5C5A56)] leading-relaxed">
                Frontline workers capture objective screenings on mobile devices in seconds.
                Supervisors review aggregated trends, verify flagged scans, and direct clinical
                follow-ups.
              </p>
            </div>

            {/* Role Toggle Tabs */}
            <div className="mt-10 flex gap-2 border-b border-[var(--sv-border,#D4D0C8)]">
              <button
                type="button"
                onClick={() => setWorkflowRole("worker")}
                className={`pb-3 px-5 text-sm font-semibold border-b-2 transition-all ${
                  workflowRole === "worker"
                    ? "border-teal-700 text-teal-800 dark:text-teal-300"
                    : "border-transparent text-[var(--sv-muted,#5C5A56)] hover:text-[var(--sv-text,#1C1B19)]"
                }`}
              >
                Frontline Health Worker Workflow
              </button>
              <button
                type="button"
                onClick={() => setWorkflowRole("supervisor")}
                className={`pb-3 px-5 text-sm font-semibold border-b-2 transition-all ${
                  workflowRole === "supervisor"
                    ? "border-teal-700 text-teal-800 dark:text-teal-300"
                    : "border-transparent text-[var(--sv-muted,#5C5A56)] hover:text-[var(--sv-text,#1C1B19)]"
                }`}
              >
                Public Health Supervisor Workflow
              </button>
            </div>

            {/* Workflow Content */}
            <div className="mt-8">
              {workflowRole === "worker" ? (
                <div className="grid gap-6 md:grid-cols-5">
                  {[
                    {
                      step: "01",
                      title: "Open & Align",
                      desc: "Open PoshanScan on mobile; review camera angle guidelines with zero setup friction.",
                    },
                    {
                      step: "02",
                      title: "Affix Marker",
                      desc: "Place the 50 mm reference ArUco marker at child's mid-upper arm point.",
                    },
                    {
                      step: "03",
                      title: "Guided Photo",
                      desc: "Viewfinder confirms marker corners and distance before triggering rapid capture.",
                    },
                    {
                      step: "04",
                      title: "Instant Band",
                      desc: "Device estimates MUAC and indicates WHO band (Normal, MAM, or SAM).",
                    },
                    {
                      step: "05",
                      title: "Auto-Sync",
                      desc: "Screening record streams securely to the supervisor portal (offline queue supported).",
                    },
                  ].map((s) => (
                    <div
                      key={s.step}
                      className="rounded-lg border border-[var(--sv-border,#D4D0C8)] bg-[var(--sv-bg,#FAF9F6)] p-5"
                    >
                      <span className="font-mono text-xs font-bold text-teal-800 dark:text-teal-400">
                        STEP {s.step}
                      </span>
                      <h4 className="mt-2 font-semibold text-base text-[var(--sv-text,#1C1B19)]">
                        {s.title}
                      </h4>
                      <p className="mt-2 text-xs text-[var(--sv-muted,#5C5A56)] leading-relaxed">
                        {s.desc}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Supervisor Steps */}
                  <div className="grid gap-6 md:grid-cols-5">
                    {[
                      {
                        step: "01",
                        title: "District Situation",
                        desc: "Monitor live KPI cards: SAM prevalence, active workers, and volume across blocks.",
                      },
                      {
                        step: "02",
                        title: "Risk Mapping",
                        desc: "Geospatial cluster map pinpointing villages with highest severe wasting rates.",
                      },
                      {
                        step: "03",
                        title: "Flagged Queue",
                        desc: "Master-detail review queue isolating SAM and low-confidence scans for validation.",
                      },
                      {
                        step: "04",
                        title: "Copy Referrals",
                        desc: "Generate clinical referral summaries directly into clipboard for local health posts.",
                      },
                      {
                        step: "05",
                        title: "Reports & Export",
                        desc: "One-click district CSV downloads with Bearer token authentication and print-ready A4 reports.",
                      },
                    ].map((s) => (
                      <div
                        key={s.step}
                        className="rounded-lg border border-[var(--sv-border,#D4D0C8)] bg-[var(--sv-bg,#FAF9F6)] p-5"
                      >
                        <span className="font-mono text-xs font-bold text-teal-800 dark:text-teal-400">
                          STAGE {s.step}
                        </span>
                        <h4 className="mt-2 font-semibold text-base text-[var(--sv-text,#1C1B19)]">
                          {s.title}
                        </h4>
                        <p className="mt-2 text-xs text-[var(--sv-muted,#5C5A56)] leading-relaxed">
                          {s.desc}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Lightweight SVG/CSS Previews of Supervisor Modules (NO Recharts/Leaflet in Landing bundle) */}
                  <div className="mt-8 rounded-xl border border-[var(--sv-border,#D4D0C8)] bg-[var(--sv-bg,#FAF9F6)] p-6">
                    <p className="text-xs font-bold uppercase tracking-wider text-[var(--sv-muted,#5C5A56)] mb-4">
                      Supervisor Portal Interface Previews
                    </p>
                    <div className="grid gap-4 md:grid-cols-3">
                      {/* SVG Mockup 1: Overview */}
                      <div className="rounded-lg border border-[var(--sv-border,#D4D0C8)] bg-[var(--sv-surface,#FFFFFF)] p-4 shadow-sm">
                        <div className="flex items-center justify-between border-b border-[var(--sv-border,#D4D0C8)] pb-2 mb-3">
                          <span className="text-xs font-bold">Situation Room (Overview)</span>
                          <span className="w-2 h-2 rounded-full bg-teal-600" />
                        </div>
                        <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                          <div className="p-2 bg-zinc-50 dark:bg-zinc-900 rounded">
                            <span className="text-[9px] text-[var(--sv-muted,#5C5A56)] block">
                              TOTAL SCANS
                            </span>
                            <span className="font-bold text-sm">1,482</span>
                          </div>
                          <div className="p-2 bg-rose-50 dark:bg-rose-950/40 rounded">
                            <span className="text-[9px] text-rose-600 block">SAM CASES</span>
                            <span className="font-bold text-sm text-rose-600">42 (2.8%)</span>
                          </div>
                        </div>
                        {/* Mini SVG Donut */}
                        <div className="mt-3 flex items-center justify-center h-16">
                          <svg viewBox="0 0 36 36" className="w-14 h-14">
                            <path
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                              fill="none"
                              stroke="#0f766e"
                              strokeWidth="4"
                              strokeDasharray="78, 100"
                            />
                            <path
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                              fill="none"
                              stroke="#d97706"
                              strokeWidth="4"
                              strokeDasharray="18, 100"
                              strokeDashoffset="-78"
                            />
                            <path
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                              fill="none"
                              stroke="#e11d48"
                              strokeWidth="4"
                              strokeDasharray="4, 100"
                              strokeDashoffset="-96"
                            />
                          </svg>
                        </div>
                      </div>

                      {/* SVG Mockup 2: Risk Map */}
                      <div className="rounded-lg border border-[var(--sv-border,#D4D0C8)] bg-[var(--sv-surface,#FFFFFF)] p-4 shadow-sm">
                        <div className="flex items-center justify-between border-b border-[var(--sv-border,#D4D0C8)] pb-2 mb-3">
                          <span className="text-xs font-bold">Geospatial Risk Map</span>
                          <span className="text-[10px] text-[var(--sv-muted,#5C5A56)] font-mono">
                            14 Villages
                          </span>
                        </div>
                        {/* Simulated map circles */}
                        <div className="relative h-24 bg-zinc-100 dark:bg-zinc-900 rounded border border-dashed border-[var(--sv-border,#D4D0C8)] flex items-center justify-center overflow-hidden">
                          <div className="absolute top-4 left-8 w-6 h-6 rounded-full bg-rose-500/30 border border-rose-500 flex items-center justify-center text-[8px] font-bold text-rose-700">
                            6%
                          </div>
                          <div className="absolute top-10 right-10 w-8 h-8 rounded-full bg-amber-500/30 border border-amber-500 flex items-center justify-center text-[8px] font-bold text-amber-700">
                            3%
                          </div>
                          <div className="absolute bottom-3 left-16 w-5 h-5 rounded-full bg-teal-500/30 border border-teal-500 flex items-center justify-center text-[8px] font-bold text-teal-700">
                            1%
                          </div>
                          <span className="text-[10px] text-zinc-400 font-mono">
                            CartoDB Positron Layer
                          </span>
                        </div>
                      </div>

                      {/* SVG Mockup 3: Flagged Review */}
                      <div className="rounded-lg border border-[var(--sv-border,#D4D0C8)] bg-[var(--sv-surface,#FFFFFF)] p-4 shadow-sm">
                        <div className="flex items-center justify-between border-b border-[var(--sv-border,#D4D0C8)] pb-2 mb-3">
                          <span className="text-xs font-bold">Flagged Review Queue</span>
                          <span className="text-[10px] bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded font-bold font-mono">
                            7 Pending
                          </span>
                        </div>
                        <div className="space-y-1.5 font-mono text-[10px]">
                          <div className="p-1.5 rounded bg-zinc-50 dark:bg-zinc-900 flex justify-between items-center border-l-2 border-rose-600">
                            <span>#PS-9021 · 108 mm</span>
                            <span className="text-rose-600 font-bold">SAM</span>
                          </div>
                          <div className="p-1.5 rounded bg-zinc-50 dark:bg-zinc-900 flex justify-between items-center border-l-2 border-amber-500">
                            <span>#PS-8842 · 121 mm</span>
                            <span className="text-amber-600 font-bold">Low Conf</span>
                          </div>
                        </div>
                        <div className="mt-2 text-[10px] text-teal-800 dark:text-teal-400 font-medium">
                          Keyboard J/K review shortcuts enabled
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── 5. Privacy & Responsible Use ── */}
        <section id="privacy" className="border-b border-[var(--sv-border,#D4D0C8)] py-16 lg:py-24">
          <div className="mx-auto max-w-7xl px-6 lg:px-10">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-wider text-teal-800 dark:text-teal-400">
                Ethical Safeguards
              </p>
              <h2 className="mt-2 font-display text-3xl sm:text-4xl font-bold tracking-tight text-[var(--sv-text,#1C1B19)]">
                Privacy, Governance &amp; Responsible Deployment
              </h2>
              <p className="mt-4 text-base text-[var(--sv-muted,#5C5A56)] leading-relaxed">
                Health technologies must earn trust at the community level. PoshanScan is engineered
                around strict data minimization, client-side masking, and human-in-the-loop clinical
                protocols.
              </p>
            </div>

            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  icon: <UserCheck size={28} className="text-teal-700" />,
                  title: "Informed Caregiver Consent",
                  desc: "Clear visual consent guidelines prior to image capture. No facial biometric or identifiable portraiture stored.",
                },
                {
                  icon: <LockKey size={28} className="text-teal-700" />,
                  title: "Data Minimization & Masking",
                  desc: "Child names are masked by default across all supervisor triage lists with client-side reveal controls.",
                },
                {
                  icon: <ShieldCheck size={28} className="text-teal-700" />,
                  title: "Role-Based Access Control",
                  desc: "Field workers submit records in a sandboxed flow; only authorized supervisors access district analytics.",
                },
                {
                  icon: <WarningOctagon size={28} className="text-teal-700" />,
                  title: "Strict Screening-Aid Guardrails",
                  desc: "PoshanScan provides clinical triage recommendations, never automated final diagnoses. Medical staff make all admission decisions.",
                },
              ].map((p, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-[var(--sv-border,#D4D0C8)] bg-[var(--sv-surface,#FFFFFF)] p-6 shadow-sm"
                >
                  <div className="p-2.5 rounded-lg bg-teal-50 dark:bg-teal-950/60 inline-block mb-4">
                    {p.icon}
                  </div>
                  <h3 className="font-semibold text-base text-[var(--sv-text,#1C1B19)] mb-2">
                    {p.title}
                  </h3>
                  <p className="text-xs text-[var(--sv-muted,#5C5A56)] leading-relaxed">{p.desc}</p>
                </div>
              ))}
            </div>

            {/* "Built With" Strip */}
            <div className="mt-12 pt-8 border-t border-[var(--sv-border,#D4D0C8)]">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--sv-muted,#5C5A56)] mb-4 text-center">
                Built With Open Standard Technologies
              </p>
              <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs font-semibold text-[var(--sv-muted,#5C5A56)]">
                <span className="px-3 py-1.5 rounded-md bg-[var(--sv-surface,#FFFFFF)] border border-[var(--sv-border,#D4D0C8)]">
                  OpenCV ArUco
                </span>
                <span className="px-3 py-1.5 rounded-md bg-[var(--sv-surface,#FFFFFF)] border border-[var(--sv-border,#D4D0C8)]">
                  MediaPipe Pose
                </span>
                <span className="px-3 py-1.5 rounded-md bg-[var(--sv-surface,#FFFFFF)] border border-[var(--sv-border,#D4D0C8)]">
                  YOLOv8 Segmentation
                </span>
                <span className="px-3 py-1.5 rounded-md bg-[var(--sv-surface,#FFFFFF)] border border-[var(--sv-border,#D4D0C8)]">
                  FastAPI &amp; PostgreSQL
                </span>
                <span className="px-3 py-1.5 rounded-md bg-[var(--sv-surface,#FFFFFF)] border border-[var(--sv-border,#D4D0C8)]">
                  React 19 &amp; TanStack Query
                </span>
                <span className="px-3 py-1.5 rounded-md bg-[var(--sv-surface,#FFFFFF)] border border-[var(--sv-border,#D4D0C8)]">
                  WHO 2006 Child Growth Standards
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ── 6. Accessible FAQ Accordion ── */}
        <section
          id="faq"
          className="border-b border-[var(--sv-border,#D4D0C8)] py-16 lg:py-24 bg-[var(--sv-surface,#FFFFFF)]"
        >
          <div className="mx-auto max-w-4xl px-6 lg:px-10">
            <div className="text-center max-w-2xl mx-auto">
              <p className="text-xs font-bold uppercase tracking-wider text-teal-800 dark:text-teal-400">
                Common Questions
              </p>
              <h2 className="mt-2 font-display text-3xl sm:text-4xl font-bold tracking-tight text-[var(--sv-text,#1C1B19)]">
                Frequently Asked Questions
              </h2>
              <p className="mt-3 text-sm text-[var(--sv-muted,#5C5A56)]">
                Technical, clinical, and operational answers about PoshanScan.
              </p>
            </div>

            <div className="mt-10 space-y-3">
              {FAQ_ITEMS.map((item, idx) => {
                const isOpen = openFaq === idx;
                return (
                  <div
                    key={idx}
                    className="rounded-lg border border-[var(--sv-border,#D4D0C8)] bg-[var(--sv-bg,#FAF9F6)] overflow-hidden"
                  >
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => setOpenFaq(isOpen ? null : idx)}
                      className="w-full flex items-center justify-between p-5 text-left font-semibold text-sm sm:text-base text-[var(--sv-text,#1C1B19)] hover:bg-[var(--sv-surface,#FFFFFF)] transition-colors"
                    >
                      <span>{item.q}</span>
                      <CaretDown
                        size={18}
                        className={`text-[var(--sv-muted,#5C5A56)] transition-transform ${
                          isOpen ? "rotate-180 text-teal-700" : ""
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-5 text-sm text-[var(--sv-muted,#5C5A56)] leading-relaxed border-t border-[var(--sv-border,#D4D0C8)]/60 pt-3">
                        {item.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── 7. Final Call to Action ── */}
        <section className="bg-teal-900 py-16 text-white">
          <div className="mx-auto max-w-5xl px-6 text-center lg:px-10 space-y-6">
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">
              Ready to Make Every Child Screening Count?
            </h2>
            <p className="text-teal-100 max-w-2xl mx-auto text-base leading-relaxed">
              Sign in to start field screenings or review your district’s aggregated nutrition
              outcomes on the supervisor portal.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
              <Link
                to="/worker/login"
                className="portal-btn portal-btn-outline px-6 py-3 text-sm font-semibold border-teal-200 text-white hover:bg-teal-800"
              >
                Login as Frontline Worker
              </Link>
              <Link
                to="/supervisor/login"
                className="portal-btn portal-btn-solid px-6 py-3 text-sm font-semibold bg-white text-teal-950 hover:bg-teal-50"
              >
                Login as Supervisor
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ── 8. Footer with Disclaimer & Team Block ── */}
      <footer className="border-t border-[var(--sv-border,#D4D0C8)] py-14 bg-[var(--sv-surface,#FFFFFF)]">
        <div className="mx-auto max-w-7xl px-6 lg:px-10 space-y-10">
          <div className="grid gap-8 lg:grid-cols-12 items-start">
            <div className="lg:col-span-5 space-y-3">
              <div className="flex items-center gap-3">
                <img
                  src={logo}
                  alt="PoshanScan"
                  className="h-10 w-10 object-contain"
                  width="40"
                  height="40"
                />
                <span className="font-display text-lg font-bold text-[var(--sv-text,#1C1B19)]">
                  PoshanScan Platform
                </span>
              </div>
              <p className="text-xs text-[var(--sv-muted,#5C5A56)] leading-relaxed max-w-md">
                PoshanScan is a digital child-nutrition screening aid developed to assist frontline
                health workers in measuring Mid-Upper Arm Circumference (MUAC). It connects field
                assessments with public health supervision to detect wasting earlier and more
                consistently.
              </p>
            </div>

            {/* Team Block driven by team.ts */}
            <div className="lg:col-span-7">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--sv-muted,#5C5A56)] mb-3">
                Project &amp; Research Team
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {TEAM_MEMBERS.map((member, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg border border-[var(--sv-border,#D4D0C8)] bg-[var(--sv-bg,#FAF9F6)] text-xs"
                  >
                    <div className="font-semibold text-[var(--sv-text,#1C1B19)]">{member.name}</div>
                    <div className="text-teal-800 dark:text-teal-400 font-medium">
                      {member.role}
                    </div>
                    {member.affiliation && (
                      <div className="text-[11px] text-[var(--sv-muted,#5C5A56)]">
                        {member.affiliation}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Mandatory Clinical Disclaimer */}
          <div className="border-t border-[var(--sv-border,#D4D0C8)] pt-6 text-xs text-[var(--sv-muted,#5C5A56)] leading-relaxed">
            <p className="font-semibold text-[var(--sv-text,#1C1B19)] mb-1">
              Clinical &amp; Regulatory Notice:
            </p>
            <p>
              PoshanScan is strictly a screening and triage support tool. It does not provide
              medical diagnoses, prescribe medical treatments, or replace physical examinations by
              qualified pediatric or health care personnel. All children identified with Mid-Upper
              Arm Circumference values in the MAM or SAM ranges must be clinically confirmed with
              standard Shakir tape measurement and assessed for bilateral pitting oedema before
              therapeutic nutrition admission.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between text-xs text-[var(--sv-muted,#5C5A56)] border-t border-[var(--sv-border,#D4D0C8)] pt-6">
            <span>© {new Date().getFullYear()} PoshanScan Initiative. All rights reserved.</span>
            <div className="flex gap-4">
              <a href="#how-it-works" className="hover:underline">
                Documentation
              </a>
              <a
                href={MARKER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                Download ArUco Marker
              </a>
              <Link to="/supervisor/login" className="hover:underline">
                Supervisor Portal
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
