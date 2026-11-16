import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ArrowRight, AlertTriangle, CheckCircle, UserRound, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RequireRole, WorkerShell } from "@/components/Screen";
import { api, errorMessage, type ScanResult } from "@/lib/api";
import { getMuacBands, type MuacAgeCategory } from "@/lib/muac";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/app/result/$scanId")({
  head: () => ({
    meta: [
      { title: "Screening report — PoshanScan" },
      { name: "description", content: "Detailed MUAC screening report and recommended next steps." },
    ],
  }),
  component: () => (
    <RequireRole allowed={["worker"]}>
      <Result />
    </RequireRole>
  ),
});

const guidance = {
  child_6_59m: {
    NORMAL:
      "This screening does not indicate elevated risk on the child MUAC scale. Continue routine growth and nutrition monitoring under your local protocol. Encourage age-appropriate nutritious feeding and seek assessment if the child becomes unwell or concerns arise. Repeat screening at the interval recommended by your programme.",
    MAM:
      "This result indicates moderate screening risk and needs follow-up. Arrange assessment by a trained health worker to review the child's nutrition, health, and feeding. Provide counselling and any support recommended by your local programme. Schedule follow-up and repeat measurement according to the care protocol.",
    SAM:
      "This result indicates high screening risk and requires prompt clinical assessment. Refer the child urgently to an appropriate health facility or nutrition service under your local protocol. A trained clinician should assess for complications and determine the right treatment setting. If the child is very unwell or has danger signs, seek emergency care immediately.",
  },
  adult: {
    NORMAL:
      "This screening does not indicate elevated risk on the adult MUAC scale. Continue routine nutrition and health monitoring under your local protocol. Encourage a varied, adequate diet where possible. Repeat screening at the interval recommended by your programme or sooner if concerns arise.",
    MAM:
      "This result indicates moderate screening risk and should be followed up. Arrange assessment by a trained health worker to review nutrition status and possible contributing health or dietary factors. Follow local guidance for counselling, support, and any further assessment. Agree on a follow-up plan and repeat measurement as recommended.",
    SAM:
      "This result indicates high screening risk and needs prompt clinical assessment. Refer the adult to an appropriate health facility or nutrition service under your local protocol. A trained clinician should assess overall health and determine the appropriate care. If the person is acutely unwell, seek emergency care immediately.",
  },
} as const;

function Result() {
  const { scanId } = Route.useParams();
  const { user } = useAuth();
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState("");

  const addSignedInDetails = useCallback((value: ScanResult): ScanResult => {
    let savedPerson: ScanResult["child"] = undefined;
    try {
      const stored = sessionStorage.getItem(`poshanscan_person_${value.child_id}`);
      if (stored) savedPerson = JSON.parse(stored);
    } catch {
      // Ignore invalid cached profile data and use the API response.
    }
    const firstPresent = (...values: Array<string | undefined>) =>
      values.find((field) => typeof field === "string" && field.trim().length > 0);
    return {
      ...value,
      child: {
        name: firstPresent(value.child?.name, savedPerson?.name),
        dob: firstPresent(value.child?.dob, savedPerson?.dob),
        gender: firstPresent(value.child?.gender, savedPerson?.gender),
        village: firstPresent(value.child?.village, savedPerson?.village),
        guardian_name: firstPresent(value.child?.guardian_name, savedPerson?.guardian_name),
      },
      child_name: firstPresent(value.child_name, value.name, value.child?.name, savedPerson?.name),
      dob: firstPresent(value.dob, value.child?.dob, savedPerson?.dob),
      gender: firstPresent(value.gender, value.child?.gender, savedPerson?.gender),
      village: firstPresent(value.village, value.child?.village, savedPerson?.village),
      guardian_name: firstPresent(
        value.guardian_name,
        value.child?.guardian_name,
        savedPerson?.guardian_name,
      ),
      worker: {
        name: firstPresent(
          value.worker?.name,
          value.worker_name,
          user?.name,
          user ? `Worker ${user.user_id}` : undefined,
        ),
        phone: firstPresent(value.worker?.phone, value.worker_phone, user?.phone),
      },
      worker_id: firstPresent(value.worker_id, user?.user_id),
    };
  }, [user]);

  useEffect(() => {
    const cached = sessionStorage.getItem(`poshanscan_result_${scanId}`);
    if (cached) {
      try {
        setResult(addSignedInDetails(JSON.parse(cached)));
      } catch {
        sessionStorage.removeItem(`poshanscan_result_${scanId}`);
      }
    }
    api
      .get<ScanResult>(`/scans/${encodeURIComponent(scanId)}`)
      .then(({ data }) => setResult(addSignedInDetails(data)))
      .catch((cause) => {
        if (!sessionStorage.getItem(`poshanscan_result_${scanId}`)) {
          setError(errorMessage(cause));
        }
      });
  }, [scanId, addSignedInDetails]);

  return (
    <WorkerShell title="Screening report">
      {result ? <Report result={result} /> : <p className="text-muted-foreground">{error || "Loading report…"}</p>}
    </WorkerShell>
  );
}

function Report({ result }: { result: ScanResult }) {
  const category: MuacAgeCategory =
    result.age_category === "adult" ? "adult" : "child_6_59m";
  const bands = getMuacBands(category);
  const value = Number(result.muac_estimate_mm);
  const clampedValue = Math.max(bands.min, Math.min(bands.max, value));
  const position = ((clampedValue - bands.min) / (bands.max - bands.min)) * 100;
  const severeWidth = ((bands.severeBelow - bands.min) / (bands.max - bands.min)) * 100;
  const moderateWidth = ((bands.moderateBelow - bands.severeBelow) / (bands.max - bands.min)) * 100;
  const normalWidth = 100 - severeWidth - moderateWidth;
  const subject = result.child ?? {};
  const subjectName = subject.name ?? result.child_name ?? result.name ?? result.child_id;
  const workerName =
    result.worker?.name ||
    result.worker_name ||
    (result.worker_id ? `Worker ${result.worker_id}` : "Signed-in field worker");
  const workerPhone = result.worker?.phone || result.worker_phone;
  const recordedAt = result.captured_at ?? result.created_at;
  const bandLabel =
    result.risk_band === "NORMAL"
      ? "Normal"
      : result.risk_band === "MAM"
        ? "Moderate risk (MAM)"
        : "High risk (SAM)";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="text-center">
        <p className="eyebrow">POSHANSCAN SCREENING REPORT</p>
        <h2 className="mt-2 font-display text-3xl font-semibold">MUAC assessment summary</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Review the measured value, applicable scale, and recommended follow-up.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <InfoCard icon={<UserRound size={18} />} title={category === "adult" ? "Adult details" : "Child details"}>
          <Detail label="Name" value={subjectName} />
          <Detail label="ID" value={result.child_id} />
          <Detail label="Date of birth" value={subject.dob ?? result.dob} />
          <Detail label="Gender" value={subject.gender ?? result.gender} />
          <Detail label="Village" value={subject.village ?? result.village} />
          <Detail label="Guardian" value={subject.guardian_name ?? result.guardian_name} />
        </InfoCard>
        <InfoCard icon={<UsersRound size={18} />} title="Screening details">
          <Detail label="Field worker" value={workerName} />
          <Detail label="Worker ID" value={result.worker_id} />
          <Detail label="Worker phone" value={workerPhone} />
          <Detail label="Scan ID" value={result.scan_id} />
          <Detail label="Captured" value={recordedAt ? new Date(recordedAt).toLocaleString() : undefined} />
          <Detail label="Reference marker" value={`${result.reference_size_mm ?? 50} mm ArUco`} />
          <Detail label="Cohort" value={bands.label} />
        </InfoCard>
      </div>

      <section className="panel p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">MEASUREMENT SCALE</p>
            <h3 className="mt-2 text-xl font-semibold">
              {category === "adult" ? "Adult MUAC scale" : "Child MUAC scale (6–59 months)"}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Thresholds: SAM &lt; {bands.severeBelow} mm · MAM {bands.severeBelow}–&lt;
              {bands.moderateBelow} mm · Normal ≥ {bands.moderateBelow} mm
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Received MUAC</p>
            <p className="font-display text-4xl font-semibold">{value.toFixed(1)} mm</p>
          </div>
        </div>
        <div className="relative mt-8 pt-7">
          <div className="absolute top-0 -translate-x-1/2 text-center" style={{ left: `${position}%` }}>
            <span className="rounded bg-foreground px-2 py-1 font-mono text-xs font-bold text-background">
              {value.toFixed(1)} mm
            </span>
            <div className="mx-auto h-2 w-0 border-x-4 border-t-4 border-x-transparent border-t-foreground" />
          </div>
          <div className="flex h-8 overflow-hidden rounded-md text-center text-xs font-bold text-white shadow-inner">
            <div style={{ width: `${severeWidth}%` }} className="flex items-center justify-center bg-rose-600">
              SAM (&lt;{bands.severeBelow})
            </div>
            <div style={{ width: `${moderateWidth}%` }} className="flex items-center justify-center bg-amber-500 text-zinc-900">
              MAM
            </div>
            <div style={{ width: `${normalWidth}%` }} className="flex items-center justify-center bg-teal-700">
              Normal (≥{bands.moderateBelow})
            </div>
          </div>
          <div className="mt-2 flex justify-between font-mono text-xs text-muted-foreground">
            <span>{bands.min} mm</span>
            <span>{bands.severeBelow} mm</span>
            <span>{bands.moderateBelow} mm</span>
            <span>{bands.max} mm</span>
          </div>
        </div>
      </section>

      <section className="panel p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
          <div>
            <p className="eyebrow">SCREENING RESULT</p>
            <p className="mt-2 text-sm text-muted-foreground">Backend classification for the selected cohort</p>
          </div>
          <span className={`rounded-md px-4 py-2 text-sm font-bold ${result.risk_band === "NORMAL" ? "bg-success-soft text-success" : result.risk_band === "MAM" ? "bg-warning-soft text-warning" : "bg-danger-soft text-danger"}`}>
            {bandLabel}
          </span>
        </div>
        <div className="mt-6 grid gap-6 sm:grid-cols-3">
          <Metric label="Estimated MUAC" value={`${value.toFixed(1)} mm`} />
          <Metric label="Model confidence" value={`${Math.round(result.confidence_score * 100)}%`} />
          <Metric label="Applied category" value={category === "adult" ? "Adult" : "Child"} />
        </div>
        <div className="mt-7 rounded-md border border-border bg-secondary/40 p-5">
          <h3 className="font-semibold">Recommended next step</h3>
          <p className="mt-2 leading-relaxed text-muted-foreground">
            {guidance[category][result.risk_band] || "Confirm this result with a trained health worker."}
          </p>
        </div>
        {result.confidence_score < 0.6 && (
          <p className="mt-5 flex items-center gap-2 rounded-md bg-warning-soft p-3 text-sm font-medium text-warning">
            <AlertTriangle size={18} /> Low confidence — repeat the scan and confirm with a standard MUAC tape.
          </p>
        )}
        {result.risk_band === "NORMAL" && <p className="mt-5 flex items-center gap-2 text-sm text-success"><CheckCircle size={18} /> No elevated screening risk indicated by this scale.</p>}
      </section>

      <p className="text-center text-sm text-muted-foreground">
        PoshanScan is a screening aid, not a medical diagnosis. Always confirm abnormal or low-confidence results with a trained health worker.
      </p>
      <div className="flex justify-center">
        <Button asChild size="lg">
          <Link to="/app/scan">
            Start another screening <ArrowRight />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function InfoCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="panel p-6">
      <h3 className="flex items-center gap-2 font-semibold">{icon}{title}</h3>
      <div className="mt-5 divide-y divide-border">{children}</div>
    </section>
  );
}

function Detail({ label, value }: { label: string; value?: string | number }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value || "Not provided"}</span>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-2xl font-semibold">{value}</p>
    </div>
  );
}
