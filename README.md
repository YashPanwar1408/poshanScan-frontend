# PoshanScan — Digital Child Malnutrition Screening & Supervisor Portal

[![Vite](https://img.shields.io/badge/Vite-6.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.x-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)

**PoshanScan** is an AI-assisted, smartphone-based Mid-Upper Arm Circumference (MUAC) screening and public health monitoring platform. Designed for community health workers (ASHAs and Anganwadi staff) and district health supervisors in India, it transforms standard mobile cameras into calibrated anthropometric triage tools to identify childhood acute malnutrition early and consistently.

---

## 📋 Clinical & Project Context

Child malnutrition is traditionally screened using manual Shakir tapes, which can be prone to human variation, parallax errors, and paper documentation delays. PoshanScan bridges this gap by combining mobile computer vision with an auditable public health command center:

- **Target Demographic**: Children aged **6 to 59 months**.
- **Calibration Marker**: A standard printed **50 mm square ArUco marker** held next to the upper arm midpoint ($d \approx 30\text{--}40\text{ cm}$, perpendicular capture).
- **Measurement Pipeline**: 
  1. Optical scale extraction ($S = 50.0\text{ mm} / w_{\text{marker\_px}}$).
  2. Anatomical landmarking (acromion to olecranon midpoint).
  3. Deep contour edge segmentation of arm skin boundary.
  4. Geometric ellipse circumference model ($\text{MUAC} \approx \pi \cdot k \cdot w_{\text{arm}}$, $k \approx 1.22\text{--}1.35$).
  5. Instant assignment into **WHO Screening Bands**:
     - 🟢 **Normal**: $\ge 125\text{ mm}$ (Adequate nutrition)
     - 🟡 **MAM** (Moderate Acute Malnutrition): $115\text{ to } <125\text{ mm}$ (Supplementary feeding & monitoring)
     - 🔴 **SAM** (Severe Acute Malnutrition): $<115\text{ mm}$ (Urgent referral to Nutrition Rehabilitation Centres / NRC)

> [!IMPORTANT]
> **Screening Aid Only**: PoshanScan is strictly an assistive frontline screening and triage tool, not a clinical diagnosis. All flagged or severe cases are verified by trained medical personnel using standardized physical anthropometry.

---

## 🏛️ Application Architecture

The frontend application consists of three integrated interfaces:

### 1. Public Landing Page (`/`)
- Interactive smartphone scan simulation showcasing live child triage, viewfinder HUD, and ArUco marker tracking.
- Interactive 6-stage computer vision measurement pipeline walkthrough.
- Instant WHO classification reference guide.
- Downloadable printable 50 mm ArUco reference markers.
- Team, methodology, and FAQ sections.

### 2. Frontline Worker Mobile Flow (`/worker/login`, `/app`)
- Lightweight mobile-first interface optimized for field use on low-cost Android smartphones.
- Real-time camera viewfinder with sharpness checks, distance verification, and marker orientation guide.
- Offline-capable scanning queue with automatic background sync when connectivity is restored.

### 3. Supervisor Command Portal (`/supervisor/*`)
A rich, accessible command center for block program managers and district medical officers:
- **/supervisor/overview** (*Situation Room*): Real-time screening counter, 5 core KPI cards with 14-day sparklines, WHO triage donut chart, and automated insight generator.
- **/supervisor/trends** (*Epidemiological Time-Series*): Multi-band area charts, 7-day moving averages, SAM outbreak callouts, and day-of-week screening density heatmaps.
- **/supervisor/locations** (*Geographic Risk Map*): CartoDB Positron and Dark interactive maps, village cluster indicators, bubble volume vs. risk modes, and village detail drawers.
- **/supervisor/workers** (*Field Team Caseloads*): TanStack Data Table of worker screening volumes, average confidence metrics, active village badges, and worker caseload profile slide-over.
- **/supervisor/flagged** (*Clinical Triage Queue*): Master-detail triage interface for SAM and low-confidence (<60%) scans, interactive 60–180 mm MUAC anatomical scale, keyboard shortcuts (`j`/`k`/`r`), and single/bulk verification.
- **/supervisor/reports** (*Data Export & Audit*): Streamed authenticated CSV downloads, live Papaparse in-browser table preview, and print-optimized A4 executive summaries.
- **/supervisor/dev/api** (*API Inspector*): Real-time live endpoint latency, status monitor, and payload inspector.

---

## 🔌 Backend Integration & Credentials

The application connects directly to the live PoshanScan FastAPI backend service.

### Live Backend Service
- **Base URL**: `https://poshanscan-backend.onrender.com`
- **Default Supervisor Login Credentials**:
  - **Phone / Admin ID**: `admin`
  - **Password**: `admin`

### API Endpoint Contract

| Endpoint | Method | Auth | Description |
| :--- | :--- | :--- | :--- |
| `/supervisor/login` | `POST` | Public | Authenticates supervisor/admin; returns JWT Bearer token |
| `/supervisor/dashboard/overview` | `GET` | Bearer | Aggregated scan totals, WHO band counts, flagged counts |
| `/supervisor/dashboard/trends` | `GET` | Bearer | Longitudinal time-series data grouped by day or week |
| `/supervisor/dashboard/locations` | `GET` | Bearer | Geographic coordinates, village scan volumes, and risk rates |
| `/supervisor/dashboard/workers` | `GET` | Bearer | Frontline worker caseloads, screening quality, and coverage |
| `/supervisor/dashboard/flagged` | `GET` | Bearer | Flagged queue (`?status=pending` or `?status=reviewed`) |
| `/supervisor/dashboard/flagged/{id}/review` | `POST` | Bearer | Submits clinical review action and notes for a scan |
| `/supervisor/dashboard/export` | `GET` | Bearer | Generates streaming CSV dataset filtered by age category |

---

## 🛠️ Tech Stack

- **Runtime & Tooling**: [Node.js](https://nodejs.org/) (>= 18), [Vite](https://vitejs.dev/)
- **Core Framework**: [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/)
- **Routing**: [TanStack Router](https://tanstack.com/router) (file-based routing with strict type safety)
- **Data Fetching & Cache**: [TanStack Query v5](https://tanstack.com/query) (stale-while-revalidate, optimistic mutations, query cancellation)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand) with localStorage persistence
- **Styling & Design System**: [Tailwind CSS v4](https://tailwindcss.com/), CSS variables, custom typography (JetBrains Mono & Inter), Radix UI primitives
- **Data Visualization**: [Recharts](https://recharts.org/), [Leaflet](https://leafletjs.com/) with CartoDB Positron/Dark basemaps
- **Motion & Interactions**: [Framer Motion](https://www.framer.com/motion/)
- **Form & Validation**: [React Hook Form](https://react-hook-form.com/), [Zod](https://zod.dev/)

---

## 🚀 Getting Started

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/your-org/PoshanScan-Dashboard.git
cd PoshanScan-Dashboard/poshanScan-frontend
npm install
```

### 2. Configure Environment

Create or verify `.env` in `poshanScan-frontend/`:

```ini
# FastAPI Backend URL
VITE_API_BASE_URL=https://poshanscan-backend.onrender.com

# Physical reference marker settings
VITE_REFERENCE_TYPE=aruco
VITE_REFERENCE_SIZE_MM=50
VITE_MIN_SHARPNESS=40
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser:
- Public Landing Page: `http://localhost:5173/`
- Supervisor Portal: `http://localhost:5173/supervisor/login`
- Frontline Worker Flow: `http://localhost:5173/worker/login`

### 4. Build & Verification

```bash
# Typecheck
npx tsc --noEmit

# Unit & component tests
npm test

# Production build
npm run build

# Preview production bundle
npm run preview
```

---

## ⌨️ Productivity & Accessibility Shortcuts

The Supervisor Portal includes global keyboard navigation:

| Key Binding | Action |
| :--- | :--- |
| `Ctrl + K` / `Cmd + K` | Open global Command Palette (search views, actions, cache jumps) |
| `g` then `o` | Navigate to **Overview** (Situation Room) |
| `g` then `t` | Navigate to **Trends** (Time-Series) |
| `g` then `l` | Navigate to **Locations** (Risk Map) |
| `g` then `w` | Navigate to **Workers** (Field Team) |
| `g` then `f` | Navigate to **Flagged** (Review Queue) |
| `g` then `r` | Navigate to **Reports** (CSV Export) |
| `j` / `k` | Next / previous scan in Flagged Queue |
| `r` | Mark selected scan as reviewed |
| `?` | Show Keyboard Shortcuts cheat sheet |

---

## 📁 Repository Directory Map

```
poshanScan-frontend/
├── src/
│   ├── assets/               # Child MUAC photos, ArUco markers, branding logos
│   ├── components/           # Shared UI primitives, UtilityBar, Icon wrappers
│   ├── data/                 # Team profiles, static reference datasets
│   ├── routes/               # TanStack Router route definitions
│   │   ├── index.tsx         # Landing page (hero simulation, pipeline, FAQ)
│   │   ├── worker.login.tsx  # Worker authentication
│   │   ├── app/              # Worker camera & screening flows (read-only)
│   │   └── supervisor.*.tsx  # Supervisor portal route endpoints
│   ├── supervisor/           # Dedicated Supervisor Portal architecture
│   │   ├── api/              # Axios client, Zod schemas, TanStack Query hooks, adapters
│   │   ├── components/       # AppShell, CommandPalette, KpiCard, MuacScale, Primitives
│   │   ├── pages/            # OverviewPage, TrendsPage, LocationsPage, WorkersPage, FlaggedPage, ReportsPage, LoginPage
│   │   ├── store/            # Zustand session and UI preferences stores
│   │   └── styles/           # CSS design tokens, themes, and typography
│   └── test/                 # Test suites for supervisor flows and components
├── .env                      # Environment configuration
├── package.json              # Project dependencies and npm scripts
└── vite.config.ts            # Vite bundler configuration
```

---

## 🛡️ Privacy & Security Safeguards

- **De-identified Review Queue**: Children's names are masked by default behind clinical reference codes (`SCAN-XXXX-XX`) to preserve privacy in field environments.
- **Role-Based Guards**: Supervisor routes are guarded by JWT role authentication. Worker credentials cannot access supervisor analytics endpoints.
- **Non-destructive Optimistic Updates**: Triage mutations update the UI optimistically and automatically roll back with an inline error notification if backend synchronization fails.
 