import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Camera, RotateCcw, Upload, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RequireRole, WorkerShell } from "@/components/Screen";
import { useAuth } from "@/lib/auth";
import { api, errorMessage, type ScanResult } from "@/lib/api";
import { saveQueued } from "@/lib/offline";
export const Route = createFileRoute("/app/capture/$childId")({
  validateSearch: (search: Record<string, unknown>) => ({
    age_category:
      search["age_category"] === "adult"
        ? ("adult" as const)
        : search["age_category"] === "child_6_59m"
          ? ("child_6_59m" as const)
          : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Capture photo — PoshanScan" },
      { name: "description", content: "Guided photo capture for MUAC screening." },
      { property: "og:title", content: "Capture photo — PoshanScan" },
      { property: "og:description", content: "Guided photo capture for MUAC screening." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireRole allowed={["worker"]}>
      <Capture />
    </RequireRole>
  ),
});
function Capture() {
  const { childId } = Route.useParams();
  const { age_category } = Route.useSearch();
  const { user } = useAuth();
  const navigate = useNavigate();
  const effectiveAgeCategory =
    age_category ??
    (typeof window !== "undefined"
      ? (sessionStorage.getItem("poshanscan_age_category") as
          | "child_6_59m"
          | "adult"
          | null)
      : null);
  const video = useRef<HTMLVideoElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState("");
  const [cameraError, setCameraError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [queued, setQueued] = useState(false);
  const [size, setSize] = useState(Number(import.meta.env["VITE_REFERENCE_SIZE_MM"]) || 50);
  useEffect(() => {
    let active = true;
    async function start() {
      try {
        const media = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (!active) {
          media.getTracks().forEach((t) => t.stop());
          return;
        }
        stream.current = media;
        if (video.current) {
          video.current.srcObject = media;
          await video.current.play();
        }
      } catch {
        if (active) setCameraError("Camera unavailable. You can upload a photo instead.");
      }
    }
    if (!photo) start();
    return () => {
      active = false;
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = null;
    };
  }, [photo]);
  useEffect(() => {
    if (!photo) return;
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  function capture() {
    const el = video.current;
    if (!el || !el.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = el.videoWidth;
    canvas.height = el.videoHeight;
    canvas.getContext("2d")?.drawImage(el, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) setPhoto(blob);
      },
      "image/jpeg",
      0.9,
    );
  }
  function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    setError("");
    setPhoto(file);
  }
  async function submit() {
    if (!photo) {
      setError("Please capture or upload a photo first.");
      return;
    }
    if (!user) {
      setError("Your session has expired. Please log in again.");
      return;
    }
    if (!effectiveAgeCategory) {
      setError("Please choose whether this screening is for a child or an adult.");
      return;
    }
    if (!size || size <= 0) {
      setError("Enter a valid marker size before submitting.");
      return;
    }
    setBusy(true);
    setError("");
    const metadata = {
      child_id: childId,
      worker_id: user.user_id,
      client_scan_id: crypto.randomUUID(),
      captured_at: new Date().toISOString(),
      reference_type: import.meta.env["VITE_REFERENCE_TYPE"] || "aruco",
      reference_size_mm: size,
      age_category: effectiveAgeCategory,
    };
    const data = new FormData();
    data.append("image", new File([photo], "capture.jpg", { type: photo.type || "image/jpeg" }));
    Object.entries(metadata).forEach(([k, v]) => data.append(k, String(v)));
    try {
      if (!navigator.onLine) throw new Error("offline");
      const response = await api.post<ScanResult>("/scans", data);
      sessionStorage.setItem(
        `poshanscan_result_${response.data.scan_id}`,
        JSON.stringify(response.data),
      );
      navigate({ to: "/app/result/$scanId", params: { scanId: response.data.scan_id } });
    } catch (e) {
      if (!navigator.onLine || (e instanceof Error && e.message === "offline")) {
        try {
          await saveQueued({ ...metadata, image: photo });
          setQueued(true);
        } catch {
          setError("Could not save your photo offline. Please try again.");
        }
      } else {
        const code = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
        setError(
          code === "reference_object_not_detected"
            ? "We couldn't see the marker clearly. Please retake the photo with the marker fully visible."
            : code === "arm_not_detected"
              ? "We couldn't clearly see the arm. Please retake with better lighting and framing."
              : errorMessage(e),
        );
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <WorkerShell title="Capture screening photo">
      <div className="grid max-w-5xl gap-10 lg:grid-cols-[1.2fr_.8fr]">
        <div>
          {queued ? (
            <div className="panel p-10 text-center">
              <Upload className="mx-auto text-primary" size={36} />
              <h2 className="mt-4 text-xl font-semibold">Saved for sync</h2>
              <p className="mt-3 text-muted-foreground">
                Your scan is safely saved on this device. It will upload when your connection
                returns.
              </p>
              <Button
                className="mt-6"
                onClick={() => navigate({ to: "/app/children", search: { register: false } })}
              >
                Scan another child
              </Button>
            </div>
          ) : (
            <>
              <div className="relative aspect-[4/5] overflow-hidden rounded-md bg-foreground">
                {photo ? (
                  <img
                    src={preview}
                    alt="Captured screening photo"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <>
                    <video
                      ref={video}
                      playsInline
                      muted
                      autoPlay
                      className="h-full w-full object-cover"
                    />
                    <div className="pointer-events-none absolute inset-[15%] border-2 border-dashed border-primary-foreground/80">
                      <div className="absolute -bottom-9 left-1/2 w-max max-w-full -translate-x-1/2 text-center text-sm font-semibold text-primary-foreground">
                        Keep arm and marker inside the guide
                      </div>
                    </div>
                  </>
                )}
              </div>
              {cameraError && !photo && <p className="mt-3 text-sm text-warning">{cameraError}</p>}
              {error && (
                <div
                  role="alert"
                  className="mt-4 flex gap-2 rounded-md bg-danger-soft p-4 text-sm text-danger"
                >
                  <AlertCircle size={18} className="shrink-0" />
                  {error}
                </div>
              )}
              <div className="mt-5 flex flex-wrap gap-3">
                {photo ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setPhoto(null);
                        setError("");
                      }}
                      disabled={busy}
                    >
                      <RotateCcw /> Retake
                    </Button>
                    <Button
                      type="button"
                      onClick={submit}
                      disabled={busy || !size || size <= 0}
                    >
                      {busy ? "Analyzing photo — this can take up to a minute" : "Use this photo"}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button onClick={capture} disabled={!!cameraError || !effectiveAgeCategory}>
                      <Camera /> Capture photo
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInput.current?.click()}
                    >
                      <Upload size={16} /> Upload photo
                    </Button>
                    <input
                      ref={fileInput}
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={handleUpload}
                    />
                  </>
                )}
              </div>
            </>
          )}
        </div>
        <aside>
          <p className="eyebrow">CAPTURE CHECKLIST</p>
          <h2 className="mt-3 font-display text-2xl font-semibold">Get a clear reading</h2>
          <ol className="mt-6 space-y-5 text-sm leading-relaxed text-muted-foreground">
            <li>
              <strong className="text-foreground">01 /</strong> Place the printed marker flat on the
              middle of the upper arm.
            </li>
            <li>
              <strong className="text-foreground">02 /</strong> Keep the arm relaxed and the marker
              facing the camera.
            </li>
            <li>
              <strong className="text-foreground">03 /</strong> Ensure both arm and marker fit
              inside the square guide.
            </li>
            <li>
              <strong className="text-foreground">04 /</strong> Use even lighting and avoid blur or
              shadows.
            </li>
          </ol>
          <label className="mt-8 block text-sm font-semibold">
            Measured marker size (mm)
            <input
              type="number"
              min="1"
              max="500"
              step="0.1"
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              className="field mt-2 max-w-[180px]"
            />
          </label>
          <p className="mt-2 text-xs text-muted-foreground">
            Usually 50 mm. Enter the actual size if your print differs.
          </p>
        </aside>
      </div>
    </WorkerShell>
  );
}
