import jsQR from "jsqr";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { PrimaryButton, Spinner } from "../../components/ui";
import { useCamera } from "../../hooks/useCamera";

const REC_SECONDS = 12;

// Neither MediaRecorder.stop() nor fetch() are guaranteed to ever settle
// (a stalled connection, or the recorder's 'stop' event not firing in some
// browser) — without a hard timeout either of those can leave the screen
// waiting forever with no way out, which is exactly what looked like the
// app "hanging" after recording. This guarantees an error surfaces instead.
function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

// Ports scan_qr -> scan_confirm -> scan_video -> (loop) -> scan_done ->
// analyzing -> report as one local step machine driving real API calls
// (create session, upload each sector's clip, finish, then the report
// screen takes over). See the mockup's Component.go()/startRec()/
// nextSector()/finishScan() for the reference state transitions.
export default function ScanFlow() {
  const navigate = useNavigate();
  const camera = useCamera();
  const [session, setSession] = useState(null);
  const [sectors, setSectors] = useState([]);
  const [scannedIds, setScannedIds] = useState([]);
  const [current, setCurrent] = useState(null);
  const [step, setStep] = useState("loading"); // loading|scan_qr|scan_confirm|scan_video|scan_done|analyzing
  const [recElapsed, setRecElapsed] = useState(0);
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const recTimerRef = useRef(null);
  const qrTimerRef = useRef(null);
  const canvasRef = useRef(document.createElement("canvas"));
  // Holds the recorded clip between a failed upload attempt and its
  // retry, so "Қайталап жүктеу" re-sends the same video instead of
  // calling camera.stopRecording() again on an already-stopped recorder
  // (which throws/hangs in some browsers).
  const recordedBlobRef = useRef(null);

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
    if (step === "scan_qr" || step === "scan_video") camera.start();
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
      setStep("scan_confirm");
    } catch {
      // unresolved token — keep scanning
    }
  }

  function pickNextUnscannedDemo() {
    const remaining = sectors.filter((s) => !scannedIds.includes(s.id));
    if (remaining.length === 0) return;
    setCurrent(remaining[0]);
    setStep("scan_confirm");
  }

  function startRec() {
    camera.startRecording();
    recordedBlobRef.current = null;
    setRecording(true);
    setUploadError(null);
    setRecElapsed(0);
    recTimerRef.current = setInterval(() => {
      setRecElapsed((prev) => {
        const next = prev + 0.1;
        if (next >= REC_SECONDS) clearInterval(recTimerRef.current);
        return Math.min(REC_SECONDS, next);
      });
    }, 100);
    setStep("scan_video");
  }

  async function advanceAfterRecording() {
    if (uploading) return; // guard against double-tap while a request is in flight
    clearInterval(recTimerRef.current);
    setUploading(true);
    setUploadError(null);
    try {
      // Only stop the recorder once per clip — calling stopRecording()
      // again on retry (after it's already stopped) throws/hangs in some
      // browsers, so a retry re-sends the blob we already have instead.
      if (!recordedBlobRef.current) {
        recordedBlobRef.current = await withTimeout(
          camera.stopRecording(), 8000, "Камера жауап бермей жатыр — қайталап көріңіз."
        );
        setRecording(false);
      }

      const form = new FormData();
      form.append("sector", current.id);
      form.append("video", recordedBlobRef.current, `sector-${current.label}.webm`);
      await withTimeout(
        api.post(`/api/scan-sessions/${session.id}/captures/`, form, { isForm: true }),
        30000, "Видео жүктелмеді — интернет байланысын тексеріп, қайталаңыз."
      );

      recordedBlobRef.current = null;
      const newScanned = [...scannedIds, current.id];
      setScannedIds(newScanned);
      setCurrent(null);

      if (newScanned.length >= sectors.length) setStep("scan_done");
      else setStep("scan_qr");
    } catch (err) {
      // Without this, a failed/slow upload used to leave the screen
      // exactly as-is with zero feedback — indistinguishable from a
      // frozen app. Now it's a visible, retryable error instead.
      setUploadError(err?.message || "Видео жүктелмеді. Интернет байланысын тексеріп, қайталаңыз.");
    } finally {
      setUploading(false);
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
      setUploadError(err?.message || "Есеп құрылмады. Интернет байланысын тексеріп, қайталаңыз.");
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
        <div className="subtle">Кадрлар сектор бойынша талданады</div>
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
        {uploadError && (
          <div style={{ font: "500 12.5px var(--font)", color: "var(--rec)", maxWidth: 270 }}>{uploadError}</div>
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
            Енді 12 секундтық видео. Сектор бойымен асықпай жүріңіз, камераны жапырақтан 30–40 см ұстаңыз, түптің астын да түсіріңіз.
          </div>
        </div>
        <button className="btn btn-on-dark" onClick={startRec}>Әрі қарай — түсіру</button>
      </div>
    );
  }

  if (step === "scan_video") {
    const pct = Math.round((recElapsed / REC_SECONDS) * 100);
    const canAdvance = recElapsed >= REC_SECONDS;
    return (
      <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "var(--bg-shell-darker)", color: "#fff" }}>
        <div style={{ padding: "6px 20px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--rec)", animation: "gg-rec 1s infinite" }} />
            <div style={{ font: "600 13.5px var(--font)" }}>Жазылып жатыр · {current?.label}</div>
          </div>
          <div style={{ font: "700 15px var(--mono)" }}>
            00:{String(Math.max(0, Math.ceil(REC_SECONDS - recElapsed))).padStart(2, "0")}
          </div>
        </div>
        <div style={{ flex: 1, padding: "0 16px", display: "flex", alignItems: "center" }}>
          <div style={{ width: "100%", aspectRatio: "3/4", borderRadius: 20, overflow: "hidden", position: "relative", border: "2px solid rgba(47,211,182,.5)" }}>
            <video ref={camera.videoRef} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        </div>
        <div style={{ padding: "18px 20px 30px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="progressbar-track" style={{ background: "rgba(255,255,255,.15)" }}>
            <div className="progressbar-fill" style={{ background: "var(--scan-line)", width: `${pct}%` }} />
          </div>
          <div style={{ font: "400 12.5px var(--font)", color: uploadError ? "var(--rec)" : "rgba(255,255,255,.55)", textAlign: "center" }}>
            {uploadError
              ? uploadError
              : uploading
                ? "Видео жүктелуде…"
                : canAdvance
                  ? "Материал жеткілікті — әрі қарай өтуге болады"
                  : "Камераны қатар бойымен асықпай жүргізіңіз"}
          </div>
          <button
            className="btn"
            style={{ background: canAdvance ? "var(--scan-line)" : "#fff", color: "#0B2621", opacity: uploading ? 0.7 : 1 }}
            onClick={advanceAfterRecording}
            disabled={(!recording && recElapsed === 0) || uploading}
          >
            {uploading ? <Spinner /> : uploadError ? "Қайталап жүктеу" : scannedIds.length + 1 >= sectors.length ? "Шолуды аяқтау" : "Әрі қарай"}
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
        {uploadError && (
          <div style={{ font: "500 12.5px var(--font)", color: "var(--rec)", textAlign: "center" }}>{uploadError}</div>
        )}
        <button className="btn btn-on-dark" onClick={pickNextUnscannedDemo}>Белгіні оқу (демо)</button>
        <button className="btn btn-outline-on-dark" onClick={finishScan}>Дайын — есеп құру</button>
      </div>
    </div>
  );
}
