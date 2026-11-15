# PoshanScan Frontend

> A mobile-first MUAC screening interface for frontline workers and a data-rich
> monitoring portal for public-health supervisors.

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=111827)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![TanStack Router](https://img.shields.io/badge/TanStack_Router-file--based-FF4154)](https://tanstack.com/router)
[![License](https://img.shields.io/badge/license-private-lightgrey)](#license)

PoshanScan helps field workers capture calibrated arm images, submit MUAC
screenings, and review results. Supervisors can monitor screening activity,
inspect trends and locations, review flagged scans, and export reports.

This repository contains the **frontend only**. Authentication, user roles,
profile persistence, image processing, MUAC estimation, risk classification,
and server-side data storage belong to the externally hosted PoshanScan API.

> [!IMPORTANT]
> PoshanScan is a screening and triage aid, not a medical diagnosis. Clinical
> teams should confirm flagged results using approved physical anthropometry and
> local referral protocols.

## Contents

- [Product surfaces](#product-surfaces)
- [How a screening works](#how-a-screening-works)
- [Technology](#technology)
- [Requirements](#requirements)
- [Run locally](#run-locally)
- [Environment variables](#environment-variables)
- [Testing and production build](#testing-and-production-build)
- [API integration](#api-integration)
- [Offline-first behavior](#offline-first-behavior)
- [Project structure](#project-structure)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

## Product surfaces

### Public landing page

Route: `/`

- Explains the screening workflow and measurement concepts.
- Demonstrates the camera and marker-guided experience.
- Provides child-focused MUAC reference information and project context.

### Frontline worker application

Routes:

- `/worker/login` - worker login and worker registration.
- `/app/scan` - choose a child or adult screening flow.
- `/app/children` - search, register, and select people for screening.
- `/app/capture/:childId` - capture or upload an image and submit a scan.
- `/app/result/:scanId` - view a detailed screening report.

The worker experience is designed for mobile devices and supports:

- Child screenings for ages 6-59 months.
- Adult screenings.
- Camera capture and image upload.
- ArUco marker-based reference-size input.
- Client-side validation and clear submission errors.
- Offline queueing of photo blobs until the API acknowledges synchronization.

### Supervisor portal

Routes:

- `/supervisor/login`
- `/supervisor/overview`
- `/supervisor/trends`
- `/supervisor/locations`
- `/supervisor/workers`
- `/supervisor/flagged`
- `/supervisor/reports`
- `/supervisor/dev/api`

The portal provides overview metrics, time-series charts, map-based location
views, worker caseloads, flagged-scan review, CSV export, and an API inspector.
Supervisor requests use a bearer token and are filtered by the selected age
category where supported.

## How a screening works

1. A worker signs in and selects **Child** or **Adult** screening.
2. The worker selects an existing person or registers a new profile.
3. The worker captures a photo or uploads one from the device.
4. The image includes the configured physical reference marker, normally a
   50 mm ArUco marker.
5. The frontend sends the image, marker metadata, person ID, worker ID,
   timestamp, and `age_category` to the API.
6. The API performs computer vision, estimates MUAC, and returns the risk band.
7. The frontend displays the returned measurement, confidence, band,
   age-specific scale, person details, worker details, and recommendations.
8. The result is available to the worker and, after synchronization, the
   supervisor portal.

The frontend does **not** calculate or override the clinical risk band. It
renders the `risk_band` returned by the backend and uses shared display
thresholds for age-appropriate visual scales.

### Age categories

| Category           | API value     | Frontend display thresholds                         |
| ------------------ | ------------- | --------------------------------------------------- |
| Child, 6-59 months | `child_6_59m` | SAM `<115 mm`, MAM `115-<125 mm`, Normal `>=125 mm` |
| Adult              | `adult`       | SAM `<210 mm`, MAM `210-<230 mm`, Normal `>=230 mm` |

These values support frontend labels and visualizations. The backend remains
the source of truth for classification.

## Technology

- [React 19](https://react.dev/) and [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vite.dev/) for development and production builds
- [TanStack Router](https://tanstack.com/router) file-based routing
- [TanStack Query](https://tanstack.com/query) for supervisor data fetching
- [Axios](https://axios-http.com/) for browser-side API requests
- [Zod](https://zod.dev/) and React Hook Form for validation
- [Tailwind CSS](https://tailwindcss.com/) and shared design tokens
- [Zustand](https://zustand.docs.pmnd.rs/) for supervisor UI/session state
- [Recharts](https://recharts.org/) for charts
- [Leaflet](https://leafletjs.com/) and React Leaflet for maps
- [Vitest](https://vitest.dev/) and Testing Library for tests

## Requirements

- Node.js 18 or newer
- npm 9 or newer
- A running PoshanScan API, or access to the configured remote API
- A modern browser for development
- Camera permission for live capture testing

## Run locally

### 1. Clone the repository

```bash
git clone https://github.com/YashPanwar1408/poshanScan-frontend.git
cd poshanScan-frontend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure the API

Create a local `.env` file in the repository root. Do not commit it.

```ini
VITE_API_BASE_URL=https://your-poshanscan-api.example.com
VITE_REFERENCE_TYPE=aruco
VITE_REFERENCE_SIZE_MM=50
```

If `VITE_API_BASE_URL` is omitted, the frontend uses
`http://localhost:8000`. The API must allow requests from the frontend origin
through its CORS configuration.

### 4. Start the development server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

Useful entry points:

- Public site: [http://localhost:5173/](http://localhost:5173/)
- Worker login: [http://localhost:5173/worker/login](http://localhost:5173/worker/login)
- Supervisor login: [http://localhost:5173/supervisor/login](http://localhost:5173/supervisor/login)

Vite is configured to listen on all interfaces, which makes device testing on
the same local network possible. Use the host machine's local IP from the
mobile device and grant camera permission when prompted.

## Environment variables

| Variable                 | Required | Default                 | Purpose                                                     |
| ------------------------ | -------- | ----------------------- | ----------------------------------------------------------- |
| `VITE_API_BASE_URL`      | No       | `http://localhost:8000` | External PoshanScan API base URL                            |
| `VITE_REFERENCE_TYPE`    | No       | `aruco`                 | Reference marker type sent with scans                       |
| `VITE_REFERENCE_SIZE_MM` | No       | `50`                    | Physical marker size used by the capture flow               |
| `VITE_MAP_API_KEY`       | No       | none                    | Optional map provider key used by supervisor location views |

Vite exposes only variables prefixed with `VITE_` to browser code. Never put
API secrets, database credentials, private keys, or privileged tokens in these
variables.

## Testing and production build

Run the checks used by this project:

```bash
# Lint the complete frontend
npm run lint

# Run the test suite once
npm test

# Type-check without emitting files
npx tsc --noEmit

# Create a production build
npm run build

# Serve the production build locally
npm run preview
```

For a focused development loop, run:

```bash
npm run dev
npm test -- --watch
```

## API integration

The frontend uses browser-side Axios clients. The worker client reads the
access token from `localStorage` under `poshanscan_token` and attaches it as a
bearer token. The API owns authorization decisions; hiding a route in the
frontend is not a security boundary.

### Worker API areas

The worker flow expects endpoints similar to:

| Method | Path               | Purpose                                   |
| ------ | ------------------ | ----------------------------------------- |
| `POST` | `/auth/login`      | Authenticate a worker                     |
| `POST` | `/auth/register`   | Register a worker account                 |
| `GET`  | `/children/search` | Search people by query and `age_category` |
| `POST` | `/children`        | Register a person with `age_category`     |
| `POST` | `/scans`           | Submit an image and scan metadata         |
| `GET`  | `/scans/{scan_id}` | Retrieve a detailed result report         |
| `POST` | `/sync`            | Acknowledge queued offline scans          |

The exact response contract is owned by the backend. A detailed scan response
should provide the scan result plus person and worker metadata when available.
The report supports both nested and flat metadata fields for compatibility:

```json
{
  "scan_id": "scan-123",
  "child_id": "person-456",
  "age_category": "adult",
  "muac_estimate_mm": 224,
  "risk_band": "MAM",
  "confidence_score": 0.91,
  "created_at": "2026-01-15T10:30:00Z",
  "child": {
    "name": "Example Person",
    "gender": "O",
    "village": "Example Village"
  },
  "worker": {
    "name": "Example Worker",
    "phone": "+910000000000"
  }
}
```

### Supervisor API areas

The supervisor portal consumes dashboard endpoints for:

- Overview metrics
- Trends and grouped screening data
- Locations and village aggregates
- Worker caseloads
- Pending/reviewed flagged scans
- Flagged-scan review actions
- Authenticated report export

The supervisor API client normalizes request failures and reports offline or
slow API status in the portal. Keep backend response changes synchronized with
the schemas and adapters in `src/supervisor/api/`.

## Offline-first behavior

When a scan cannot be submitted because the device is offline or the API is
unavailable, the worker flow stores the complete queued record in IndexedDB,
including the image `Blob`. This ensures the photo survives a page reload and
does not depend on in-memory React state.

Queued records include:

- Client scan ID
- Person and worker IDs
- Capture timestamp
- Reference type and physical size
- Age category
- Image blob

The record should be deleted only after the external sync endpoint
acknowledges it. Do not replace this flow with local risk classification or
automatic deletion after a failed request.

## Project structure

```text
poshanscan-frontend/
├── public/                 # Static public assets
├── src/
│   ├── assets/             # Logos, marker images, and screening imagery
│   ├── components/         # Shared worker and application components
│   ├── data/               # Static content used by public pages
│   ├── lib/
│   │   ├── api.ts          # Worker API client, schemas, and result types
│   │   ├── auth.tsx        # Authentication context and worker auth flow
│   │   ├── muac.ts         # Shared age-specific display thresholds
│   │   └── offline.ts      # IndexedDB scan queue
│   ├── routes/             # TanStack Start file routes
│   │   ├── app/             # Worker screening and report pages
│   │   ├── supervisor.*     # Supervisor route entry points
│   │   └── index.tsx        # Public landing page
│   ├── supervisor/
│   │   ├── api/             # Supervisor client, schemas, hooks, adapters
│   │   ├── components/      # Portal shell and reusable dashboard UI
│   │   ├── pages/           # Supervisor page implementations
│   │   ├── store/           # Supervisor session and UI state
│   │   └── styles/          # Supervisor design tokens
│   └── test/                # Frontend tests and test setup
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

TanStack Router generates `src/routeTree.gen.ts`. Do not manually edit that
file; it is regenerated when routes change.

## Deployment

The app is a client-side Vite build and can be deployed to Vercel or another
static hosting provider.

### Vercel

1. Import `YashPanwar1408/poshanScan-frontend`.
2. Set the framework preset to **Vite**.
3. Set the build command to `npm run build`.
4. Set the output directory to `dist`.
5. Add production environment variables, especially `VITE_API_BASE_URL`.
6. Configure the API CORS allowlist for the deployed frontend origin.
7. Redeploy after changing any `VITE_` variable; Vite embeds them at build time.

For direct navigation to nested routes such as `/app/result/:scanId` or
`/supervisor/reports`, configure the host to serve `index.html` as the SPA
fallback. Without that rewrite, refreshing a nested route can return a 404
even though client-side navigation works.

## Troubleshooting

### The page is blank after deployment

- Open the browser console and network panel.
- Confirm the deployment uses the current production build.
- Confirm all required `VITE_` values were set before building.
- Check that the host serves `index.html` for nested routes.
- Check that the API URL is reachable and allows the deployed origin.
- Verify that the deployment is not injecting an incompatible third-party map
  or Leaflet plugin.

### Login works locally but not in production

- Verify `VITE_API_BASE_URL` in the hosting provider's build environment.
- Confirm backend CORS includes the exact deployed origin.
- Check that the browser is not blocking mixed-content requests.
- Confirm the token is returned in the API shape expected by `authSchema`.

### Adult and child records look identical

- Confirm the frontend sends `age_category=adult` or
  `age_category=child_6_59m`.
- Confirm `/children/search` and `/children` filter and persist that field.
- Confirm the scan response includes the correct `age_category`.
- Confirm the supervisor endpoints apply the same filter.

### Names or worker details are missing in a report

The frontend cannot display fields that the API does not return. Ensure
`GET /scans/{scan_id}` includes person and worker metadata, either as nested
`child`/`worker` objects or as the supported flat fields. Until then, the UI
uses safe fallback identifiers.

### Offline scans do not appear online

- Keep the tab open long enough for synchronization to run.
- Check browser IndexedDB for the `poshanscan-offline` database.
- Inspect the `/sync` request and response in browser developer tools.
- Confirm the API acknowledges the client scan ID before the queue is cleared.

## Contributing

1. Create a focused branch from `main`.
2. Keep changes scoped to the requested behavior.
3. Reuse existing route, API, validation, and design-system patterns.
4. Do not commit `.env` files, tokens, credentials, or patient data.
5. Run lint, tests, type-checking, and a production build for code changes.
6. Include backend contract changes in the API integration notes when needed.

## License

This frontend is maintained as part of the PoshanScan project. Licensing and
deployment permissions are defined by the project owners; contact the
repository maintainers before redistributing it.
