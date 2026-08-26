import jsQR from "jsqr";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, mediaUrl } from "../../api/client";
import { PrimaryButton, Spinner } from "../../components/ui";
import { useCamera } from "../../hooks/useCamera";

// Matches the backend defaults (config/settings.py SECTOR_PHOTOS_MIN/MAX)
// — used only before the first photo of a sector is uploaded, since only
// then do we have the server's own capture.min_photos/max_photos to go by.
const DEFAULT_MIN_PHOTOS = 3;
const DEFAULT_MAX_PHOTOS = 10;

// Guided hints for the first 3 required photos — after that the farmer
// decides for themself whether the sector needs more angles or is done.
// Filming one 12s video and auto-picking a frame from it turned out to
// give OpenAI vision unreliable material (motion blur, bad framing at
// whatever moment got sampled) — a few farmer-chosen still photos from
// specific, guided angles give it much more to work with.
const GUIDED_HINTS = [
  "1-фото: сектордың жалпы көрінісін түсіріңіз — бірнеше түпті қамтыңыз.",
  "2-фото: бір жапырақты жақыннан түсіріңіз — камераны 30–40 см қашықтықта ұстаңыз.",
  "3-фото: жапырақтың астыңғы бетін немесе түптің түбірін түсіріңіз.",
];

function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

// Ports scan_qr -> scan_confirm -> scan_photos -> (loop) -> scan_done ->
// analyzing -> report as one local step machine driving real API calls
// (create session, upload each sector's photos one at a time, finish the
// sector, then finish the whole walkthrough — the report screen takes
// over from there).
export default function ScanFlow() {
  const navigate = useNavigate();
  const camera = useCamera();
  const [session, setSession] = useState(null);
  const [sectors, setSectors] = useState([]);
  const [scannedIds, setScannedIds] = useState([]);
  const [current, setCurrent] = useState(null);
  const [step, setStep] = useState("loading"); // loading|scan_qr|scan_confirm|scan_photos|scan_done|analyzing
  const [capture, setCapture] = useState(null); // this sector's SectorCapture, once the first photo is uploaded
  const [capturing, setCapturing] = useState(false); // taking + uploading one photo
  const [finishing, setFinishing] = useState(false); // finishing the sector (running diagnosis)
  const [photoError, setPhotoError] = useState(null);
  const qrTimerRef = useRef(null);
  const canvasRef = useRef(document.createElement("canvas"));

  useEffect(() => {
    (async () => {
      const greenhouses = await api.get("/api/greenhouses/");
      const gh = (greenhouses.results || greenhouses)[0];
      const created = await api.post("/api/scan-sessions/", { greenhouse: gh.id });
      setSession(created);
      setSectors(gh.sectors);
      setStep("scan_qr");
    })();
  }, []);

  useEffect(() => {
    if (step === "scan_qr" || step === "scan_confirm" || step === "scan_photos") camera.start();
    else camera.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Best-effort real QR detection while on the scan_qr step; the "Белгіні
  // оқу (демо)" button below is the reliable fallback for testing without
  // printed QR codes.
  useEffect(() => {
    if (step !== "scan_qr" || !camera.ready) return;
    qrTimerRef.current = setInterval(() => {
      const video = camera.videoRef.current;
      if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) return;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code?.data?.startsWith("zhasyldala://sector/")) {
        const token = code.data.replace("zhasyldala://sector/", "");
        handleScanned(token);
      }
    }, 400);
    return () => clearInterval(qrTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, camera.ready]);

  async function handleScanned(token) {
    clearInterval(qrTimerRef.current);
    try {
      const sector = await api.get(`/api/sectors/by-token/${token}/`);
      setCurrent(sector);
      setCapture(null);
      setStep("scan_confirm");
    } catch {
      // unresolved token — keep scanning
    }
  }

  function pickNextUnscannedDemo() {
    const remaining = sectors.filter((s) => !scannedIds.includes(s.id));
    if (remaining.length === 0) return;
    setCurrent(remaining[0]);
    setCapture(null);
    setStep("scan_photos");
  }

  async function takePhoto() {
    if (capturing) return;
    setCapturing(true);
    setPhotoError(null);
    try {
      const blob = await camera.capturePhoto();
      if (!blob) throw new Error("Камера дайын емес — қайталап көріңіз.");
      const form = new FormData();
      form.append("image", blob, `sector-${current.label}-${(capture?.photo_count || 0) + 1}.jpg`);
      const updated = await withTimeout(
        api.post(`/api/scan-sessions/${session.id}/sectors/${current.id}/photos/`, form, { isForm: true }),
        20000, "Фото жүктелмеді — интернет байланысын тексеріп, қайталаңыз."
      );
      setCapture(updated);
    } catch (err) {
      setPhotoError(err?.message || "Фото түсірілмеді. Қайталап көріңіз.");
    } finally {
      setCapturing(false);
    }
  }

  async function undoLastPhoto() {
    if (capturing || !capture || capture.photo_count === 0) return;
    setCapturing(true);
    setPhotoError(null);
    try {
      const updated = await api.post(`/api/scan-sessions/${session.id}/sectors/${current.id}/photos/undo/`, {});
      setCapture(updated);
    } catch (err) {
      setPhotoError(err?.message || "Фотоны алып тастау сәтсіз аяқталды.");
    } finally {
      setCapturing(false);
    }
  }

  async function finishSector() {
    if (finishing) return;
    setFinishing(true);
    setPhotoError(null);
    try {
      await withTimeout(
        api.post(`/api/scan-sessions/${session.id}/sectors/${current.id}/finish/`, {}),
        45000, "Сектор талданбады — интернет байланысын тексеріп, қайталаңыз."
      );
      const newScanned = [...scannedIds, current.id];
      setScannedIds(newScanned);
      setCurrent(null);
      setCapture(null);
      if (newScanned.length >= sectors.length) setStep("scan_done");
      else setStep("scan_qr");
    } catch (err) {
      setPhotoError(err?.message || "Сектор талданбады. Интернет байланысын тексеріп, қайталаңыз.");
    } finally {
      setFinishing(false);
    }
  }

  async function finishScan() {
    setStep("analyzing");
    try {
      await withTimeout(
        api.post(`/api/scan-sessions/${session.id}/finish/`, {}),
        30000, "Есеп құрылмады — интернет байланысын тексеріп, қайталаңыз."
      );
      navigate(`/app/report/${session.id}`);
    } catch (err) {
      setPhotoError(err?.message || "Есеп құрылмады. Интернет байланысын тексеріп, қайталаңыз.");
      setStep(scannedIds.length > 0 ? "scan_done" : "scan_qr");
    }
  }

  if (step === "loading") {
    return (
      <div style={{ height: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-shell-dark)" }}>
        <Spinner />
      </div>
    );
  }

  if (step === "analyzing") {
    return (
      <div style={{ height: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, padding: 40, background: "var(--bg-shell)" }}>
        <Spinner />
        <div className="title-md">Есеп дайындалып жатыр</div>
        <div className="subtle">Секторлар бойынша нәтижелер жиналуда</div>
      </div>
    );
  }

  if (step === "scan_done") {
    return (
      <div style={{ height: "100dvh", display: "flex", flexDirection: "column", justifyContent: "center", gap: 20, padding: "30px 26px", textAlign: "center", alignItems: "center", background: "var(--bg-shell)" }}>
        <div style={{ width: 58, height: 58, borderRadius: 20, background: "var(--accent-tint)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", font: "700 26px var(--font)" }}>✓</div>
        <div className="title-lg">Шолу аяқталды</div>
        <div className="subtle" style={{ maxWidth: 270 }}>
          Түсірілген сектор: {sectors.length} ішінен {scannedIds.length}. Түсірілмегендері есепте сұр болып қалады — кейін толықтыруға болады.
        </div>
        {photoError && (
          <div style={{ font: "500 12.5px var(--font)", color: "var(--rec)", maxWidth: 270 }}>{photoError}</div>
        )}
        <PrimaryButton onClick={finishScan}>Есеп құру</PrimaryButton>
        <button className="btn btn-ghost" onClick={() => setStep("scan_qr")}>Қалған секторларды түсіру</button>
      </div>
    );
  }

  if (step === "scan_confirm") {
    return (
      <div style={{ height: "100dvh", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "var(--bg-shell-dark)", padding: "24px 24px 30px", color: "#fff" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 24, marginTop: 40 }}>
          <div style={{ width: 56, height: 56, borderRadius: 18, background: "var(--scan-line)", color: "#0B2621", display: "flex", alignItems: "center", justifyContent: "center", font: "700 24px var(--font)" }}>✓</div>
          <div>
            <div style={{ font: "500 13px var(--font)", color: "rgba(255,255,255,.55)" }}>Белгі танылды</div>
            <div style={{ font: "800 40px/1.1 var(--font)", marginTop: 6 }}>{current?.label} секторы</div>
            <div style={{ font: "400 14px/1.6 var(--font)", color: "rgba(255,255,255,.6)", marginTop: 12, maxWidth: 280 }}>
              {current?.plant_count} түп
            </div>
          </div>
          <div style={{ background: "rgba(255,255,255,.07)", borderRadius: 16, padding: "14px 16px", font: "400 13px/1.6 var(--font)", color: "rgba(255,255,255,.75)" }}>
            Енді кемінде {DEFAULT_MIN_PHOTOS} фото түсіресіз (ең көбі {DEFAULT_MAX_PHOTOS}) — әр қадамда не түсіру керегін көрсетеміз.
          </div>
        </div>
        <button className="btn btn-on-dark" onClick={() => setStep("scan_photos")}>Әрі қарай — түсіру</button>
      </div>
    );
  }

  // scan_photos
  if (step === "scan_photos") {
    const photoCount = capture?.photo_count || 0;
    const minPhotos = capture?.min_photos ?? DEFAULT_MIN_PHOTOS;
    const maxPhotos = capture?.max_photos ?? DEFAULT_MAX_PHOTOS;
    const canFinish = photoCount >= minPhotos;
    const atMax = photoCount >= maxPhotos;
    const hint = photoCount < GUIDED_HINTS.length
      ? GUIDED_HINTS[photoCount]
      : atMax
        ? `Ең көп фото саны (${maxPhotos}) жетті — енді "Сектор дайын" батырмасын басыңыз.`
        : `Қаласаңыз, тағы фото қосыңыз (ең көбі ${maxPhotos}), немесе осымен жеткілікті болса — "Сектор дайын" басыңыз.`;

    return (
      <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "var(--bg-shell-darker)", color: "#fff" }}>
        <div style={{ padding: "6px 20px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ font: "600 13.5px var(--font)" }}>{current?.label} секторы</div>
          <div style={{ font: "700 13.5px var(--mono)", color: "var(--scan-line)" }}>{photoCount}/{maxPhotos}</div>
        </div>
        <div style={{ flex: 1, padding: "0 16px", display: "flex", alignItems: "center" }}>
          <div style={{ width: "100%", aspectRatio: "3/4", borderRadius: 20, overflow: "hidden", position: "relative", border: "2px solid rgba(47,211,182,.5)" }}>
            <video ref={camera.videoRef} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <div style={{ position: "absolute", inset: 20, border: "1.5px dashed rgba(255,255,255,.28)", borderRadius: 16, pointerEvents: "none" }} />
          </div>
        </div>

        {photoCount > 0 && (
          <div style={{ display: "flex", gap: 8, padding: "0 20px", overflowX: "auto" }}>
            {capture.photos.map((p) => (
              <img
                key={p.id}
                src={mediaUrl(p.image)}
                alt=""
                style={{ width: 46, height: 46, borderRadius: 10, objectFit: "cover", flex: "none", border: "1px solid rgba(255,255,255,.2)" }}
              />
            ))}
          </div>
        )}

        <div style={{ padding: "16px 20px 30px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ font: "400 12.5px var(--font)", color: photoError ? "var(--rec)" : "rgba(255,255,255,.65)", textAlign: "center", minHeight: 32 }}>
            {photoError || hint}
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 22 }}>
            <button
              className="icon-btn on-dark"
              onClick={undoLastPhoto}
              disabled={capturing || finishing || photoCount === 0}
              style={{ opacity: photoCount === 0 ? 0.35 : 1 }}
              title="Соңғы фотоны алып тастау"
            >
              ↩
            </button>
            <button
              onClick={takePhoto}
              disabled={capturing || finishing || atMax}
              style={{
                width: 74, height: 74, borderRadius: "50%", border: "4px solid rgba(255,255,255,.3)",
                background: "#fff", opacity: capturing || atMax ? 0.6 : 1,
              }}
            >
              {capturing && <Spinner />}
            </button>
            <div style={{ width: 34 }} />
          </div>

          <button
            className="btn"
            style={{ background: canFinish ? "var(--scan-line)" : "rgba(255,255,255,.12)", color: canFinish ? "#0B2621" : "rgba(255,255,255,.4)" }}
            onClick={finishSector}
            disabled={!canFinish || finishing || capturing}
          >
            {finishing ? <Spinner /> : `Сектор дайын${canFinish ? "" : ` (кемінде ${minPhotos} фото керек)`}`}
          </button>
        </div>
      </div>
    );
  }

  // scan_qr
  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "var(--bg-shell-dark)", color: "#fff" }}>
      <div style={{ padding: "6px 20px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button className="icon-btn on-dark" onClick={() => navigate("/app")}>✕</button>
        <div style={{ flex: 1, textAlign: "center", font: "600 13.5px var(--font)" }}>
          {sectors.length} сектордың {Math.min(scannedIds.length + 1, sectors.length)}-сі
        </div>
        <div style={{ width: 34 }} />
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22, padding: "0 26px" }}>
        <div style={{ width: 230, height: 230, borderRadius: 26, position: "relative", overflow: "hidden", background: "#161D1A" }}>
          <video ref={camera.videoRef} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 2, background: "var(--scan-line)", boxShadow: "0 0 14px var(--scan-line)", animation: "gg-scanline 1.8s ease-in-out infinite alternate" }} />
        </div>
        <div style={{ font: "600 16px var(--font)", textAlign: "center" }}>Сектордың QR белгісіне бағыттаңыз</div>
        <div className="subtle" style={{ color: "rgba(255,255,255,.55)", textAlign: "center", maxWidth: 250 }}>
          Қалғаны: {sectors.length - scannedIds.length} сектор. Реті маңызды емес — жүйе белгі арқылы таниды.
        </div>
      </div>
      <div style={{ padding: "18px 20px 30px", display: "flex", flexDirection: "column", gap: 10 }}>
        {photoError && (
          <div style={{ font: "500 12.5px var(--font)", color: "var(--rec)", textAlign: "center" }}>{photoError}</div>
        )}
        <button className="btn btn-on-dark" onClick={pickNextUnscannedDemo}>Белгіні оқу (демо)</button>
        <button className="btn btn-outline-on-dark" onClick={finishScan}>Дайын — есеп құру</button>
      </div>
    </div>
  );
}
