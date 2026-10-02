import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RequireRole, WorkerShell } from "@/components/Screen";
import { api, errorMessage, type ScanResult } from "@/lib/api";
export const Route = createFileRoute("/app/result/$scanId")({
  head: () => ({
    meta: [
      { title: "Screening result — PoshanScan" },
      { name: "description", content: "View an estimated MUAC and nutritional risk band." },
      { property: "og:title", content: "Screening result — PoshanScan" },
      { property: "og:description", content: "View an estimated MUAC and nutritional risk band." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireRole allowed={["worker"]}>
      <Result />
    </RequireRole>
  ),
});
const guidance = {
  NORMAL: "Continue routine care and screening according to your local protocol.",
  MAM: "Provide counselling and re-screen in 2–4 weeks. Follow your local care protocol.",
  SAM: "Refer immediately for clinical assessment. Follow your local emergency care protocol.",
};
function Result() {
  const { scanId } = Route.useParams();
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(`poshanscan_result_${scanId}`);
      if (cached) setResult(JSON.parse(cached));
    } catch {
      setResult(null);
    }
    api
      .get(`/scans/${encodeURIComponent(scanId)}`)
      .then(({ data }) => setResult(data))
      .catch((e) => {
        if (!sessionStorage.getItem(`poshanscan_result_${scanId}`)) setError(errorMessage(e));
      });
  }, [scanId]);
  return (
    <WorkerShell title="Screening result">
      {result ? (
        <div className="max-w-2xl">
          <div className="panel p-8 sm:p-10">
            <p className="eyebrow">ESTIMATED MID-UPPER ARM CIRCUMFERENCE</p>
            <div className="mt-7 flex flex-wrap items-end justify-between gap-6">
              <div>
                <span className="font-display text-7xl font-semibold">
                  {Number(result.muac_estimate_mm).toFixed(1)}
                </span>
                <span className="ml-2 text-xl text-muted-foreground">mm</span>
              </div>
              <span
                className={`rounded-md px-5 py-2 text-sm font-bold ${result.risk_band === "NORMAL" ? "bg-success-soft text-success" : result.risk_band === "MAM" ? "bg-warning-soft text-warning" : "bg-danger-soft text-danger"}`}
              >
                {result.risk_band === "NORMAL"
                  ? "Normal"
                  : result.risk_band === "MAM"
                    ? "Moderate acute malnutrition"
                    : "Severe acute malnutrition"}
              </span>
            </div>
            <div className="mt-10 border-t border-border pt-8">
              <h2 className="text-lg font-semibold">Recommended next step</h2>
              <p className="mt-2 leading-relaxed text-muted-foreground">
                {guidance[result.risk_band] || "Confirm with a trained health worker."}
              </p>
            </div>
            <div className="mt-8 border-t border-border pt-6 text-sm text-muted-foreground">
              Confidence score: {Math.round(result.confidence_score * 100)}% · Recorded{" "}
              {new Date(result.created_at).toLocaleString()}
            </div>
            {result.confidence_score < 0.6 && (
              <p className="mt-5 flex items-center gap-2 rounded-md bg-warning-soft p-3 text-sm font-medium text-warning">
                <AlertTriangle size={18} /> Low confidence — consider re-measuring
              </p>
            )}
          </div>
          <p className="mt-5 text-sm text-muted-foreground">
            PoshanScan is a screening aid, not a medical diagnosis. Always confirm results with a
            trained health worker.
          </p>
          <Button asChild className="mt-8" size="lg">
            <Link to="/app/children" search={{ register: false }}>
              Scan another child <ArrowRight />
            </Link>
          </Button>
        </div>
      ) : (
        <div className="max-w-xl text-muted-foreground">
          {error ? <p role="alert">{error}</p> : "Loading result…"}
        </div>
      )}
    </WorkerShell>
  );
}
