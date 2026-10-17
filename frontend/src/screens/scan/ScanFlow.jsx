import jsQR from "jsqr";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import Analyzing from "../../components/Analyzing";
import QueueBanner from "../../components/QueueBanner";
import { QUALITY_TEXT, checkPhotoQuality } from "../../offline/photoQuality";
import {
  enqueueFinishSector, enqueueFinishSession, enqueuePhoto, newClientId, removeQueuedPhoto, waitForSession,
} from "../../offline/uploadQueue";
import { GreenhouseMap, PrimaryButton, Spinner } from "../../components/ui";
import { useCamera } from "../../hooks/useCamera";

// Matches the backend defaults (config/settings.py SECTOR_PHOTOS_MIN/MAX).
// Photos are counted on the phone (they may still be in the offline
// queue), so these are the limits the capture screen enforces.
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
  // This sector's photos as taken on the phone: {clientId, url}. They go
  // into the offline upload queue immediately; the walkthrough never
  // waits for the network (see offline/uploadQueue.js).
  const [shots, setShots] = useState([]);
  const [capturing, setCapturing] = useState(false); // grabbing + checking one photo
  const [finishing, setFinishing] = useState(false);
  const [qualityPrompt, setQualityPrompt] = useState(null); // {blob, url, issue} awaiting "retake / keep"
  const [savedOffline, setSavedOffline] = useState(false); // report waits for the connection
  const [photoError, setPhotoError] = useState(null);
  const qrTimerRef = useRef(null);
  const canvasRef = useRef(document.createElement("canvas"));

  const [picking, setPicking] = useState(false); // manual sector picker open
  const [lastPhoto, setLastPhoto] = useState(null); // shown on the "analyzing" screen
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const greenhouses = await api.get("/api/greenhouses/");
        const gh = (greenhouses.results || greenhouses)[0];
        if (!gh) {
          navigate("/app", { replace: true });
          return;
        }
        const created = await api.post("/api/scan-sessions/", { greenhouse: gh.id });
        setSession(created);
        setSectors(gh.sectors);
        setStep("scan_qr");
      } catch {
        setLoadError("Шолу басталмады — интернет байланысын тексеріңіз.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      } else if (code?.data?.startsWith("zhasyldala://row/")) {
        handleRowScanned(parseInt(code.data.replace("zhasyldala://row/", ""), 10));
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
      setShots([]);
      setStep("scan_confirm");
    } catch {
      // unresolved token — keep scanning
    }
  }

  // Row labels ("zhasyldala://row/3") are generic, pre-printable codes —
  // not tied to any greenhouse or sector token — so they can be hung in a
  // greenhouse before it's even set up in the app, and survive the grid
  // being regenerated later. They resolve against *this* farmer's current
  // greenhouse: row N (1-based) -> the first not-yet-scanned sector in
  // that row, so scanning the same row label again walks along the row.
  function handleRowScanned(rowNumber) {
    if (!Number.isInteger(rowNumber) || rowNumber < 1) return;
    const inRow = sectors.filter((s) => s.row === rowNumber - 1).sort((a, b) => a.col - b.col);
    const next = inRow.find((s) => !scannedIds.includes(s.id));
    if (!next) {
      setPhotoError(
        inRow.length === 0
          ? `${rowNumber}-қатар жылыжайыңызда жоқ.`
          : `${rowNumber}-қатардың барлық секторлары түсірілді.`
      );
      return;
    }
    clearInterval(qrTimerRef.current);
    setPhotoError(null);
    setCurrent(next);
    setShots([]);
    setStep("scan_confirm");
  }

  // Fallback for a torn/unprinted QR label: pick the sector on the map.
  function pickSector(sector) {
    clearInterval(qrTimerRef.current);
    setPicking(false);
    setPhotoError(null);
    setCurrent(sector);
    setShots([]);
    setStep("scan_confirm");
  }

  async function takePhoto() {
    if (capturing) return;
    setCapturing(true);
    setPhotoError(null);
    try {
      const blob = await camera.capturePhoto();
      if (!blob) throw new Error("Камера дайын емес — қайталап көріңіз.");
      const quality = await checkPhotoQuality(blob);
      if (quality.issue) {
        setQualityPrompt({ blob, url: URL.createObjectURL(blob), issue: quality.issue });
        return;
      }
      await keepPhoto(blob);
    } catch (err) {
      setPhotoError(err?.message || "Фото түсірілмеді. Қайталап көріңіз.");
    } finally {
      setCapturing(false);
    }
  }

  async function keepPhoto(blob, url = URL.createObjectURL(blob)) {
    const clientId = newClientId();
    await enqueuePhoto({ sessionId: session.id, sectorId: current.id, blob, clientId });
    setShots((prev) => [...prev, { clientId, url }]);
    setLastPhoto(url);
  }

  async function resolveQuality(keep) {
    const prompt = qualityPrompt;
    setQualityPrompt(null);
    if (!prompt) return;
    if (keep) await keepPhoto(prompt.blob, prompt.url);
    else URL.revokeObjectURL(prompt.url);
  }

  async function undoLastPhoto() {
    const last = shots[shots.length - 1];
    if (capturing || !last) return;
    setCapturing(true);
    setPhotoError(null);
    try {
      // Still waiting in the queue -> just drop it; already on the
      // server -> undo there (needs a connection).
      const dropped = await removeQueuedPhoto(last.clientId);
      if (!dropped) await api.post(`/api/scan-sessions/${session.id}/sectors/${current.id}/photos/undo/`, {});
      setShots((prev) => prev.slice(0, -1));
    } catch {
      setPhotoError("Фото серверге жіберіліп қойған — оны өшіру үшін интернет керек.");
    } finally {
      setCapturing(false);
    }
  }

  async function finishSector() {
    if (finishing) return;
    setFinishing(true);
    setPhotoError(null);
    try {
      await enqueueFinishSector({ sessionId: session.id, sectorId: current.id });
      const newScanned = [...scannedIds, current.id];
      setScannedIds(newScanned);
      setCurrent(null);
      setShots([]);
      if (newScanned.length >= sectors.length) setStep("scan_done");
      else setStep("scan_qr");
    } catch {
      setPhotoError("Сақталмады — телефон жадын тексеріп, қайталаңыз.");
    } finally {
      setFinishing(false);
    }
  }

  async function finishScan() {
    setPhotoError(null);
    await enqueueFinishSession({ sessionId: session.id });
    setStep("analyzing");
    // Photos and diagnoses go up in the background; wait for them if
    // there's a connection, otherwise tell the farmer it's saved and the
    // report will appear once the phone is back online.
    const delivered = await waitForSession(session.id, navigator.onLine === false ? 4000 : 120000);
    if (delivered) navigate(`/app/report/${session.id}`);
    else setSavedOffline(true);
  }

  if (step === "loading") {
    return (
      <div style={{ height: "100dvh", display: "flex", flexDirection: "column", gap: 18, alignItems: "center", justifyContent: "center", background: "var(--bg-shell-dark)", color: "#fff", padding: 30, textAlign: "center" }}>
        {loadError ? (
          <>
            <div style={{ font: "500 14px/1.5 var(--font)" }}>{loadError}</div>
            <button className="btn btn-on-dark" onClick={() => navigate("/app")}>Басты бетке</button>
          </>
        ) : <Spinner />}
      </div>
    );
  }

  if (step === "analyzing" && savedOffline) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", justifyContent: "center", gap: 16, padding: "30px 26px", background: "var(--bg-shell)", color: "var(--ink)" }}>
        <span className="badge badge-warn" style={{ alignSelf: "flex-start" }}>Желі жоқ</span>
        <h1 className="title-lg" style={{ margin: 0 }}>Шолу телефонда сақталды</h1>
        <p className="subtle" style={{ fontSize: 14 }}>
          {scannedIds.length} сектордың фотолары жоғалмайды. Интернет пайда болғанда олар өзі жіберіледі, есеп «Шолулар тарихы» бөлімінде шығады.
        </p>
        <QueueBanner />
        <PrimaryButton onClick={() => navigate("/app")}>Басты бетке</PrimaryButton>
      </div>
    );
  }

  if (step === "analyzing") {
    return (
      <Analyzing
        photoUrl={lastPhoto}
        title="Есеп дайындалып жатыр"
        steps={["Фотолар жиналды", "Секторлар салыстырылуда", "Жылыжай картасы толтырылуда", "Есеп дайындалуда"]}
      />
    );
  }

  if (step === "scan_done") {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", justifyContent: "center", gap: 18, padding: "30px 26px", textAlign: "center", alignItems: "center", background: "var(--bg-shell)", color: "var(--ink)" }}>
        <div className="eyebrow" style={{ color: "var(--accent)" }}>{scannedIds.length} / {sectors.length} сектор</div>
        <div className="title-lg" style={{ color: "var(--ink)" }}>Шолу аяқталды</div>
        <div style={{ width: "100%", maxWidth: 300 }}>
          <GreenhouseMap
            compact
            entrance={false}
            rows={groupRows(sectors).map((row) => row.map((sec) => ({ key: sec.id, label: sec.label, tag: scannedIds.includes(sec.id) ? "ok" : "unscanned" })))}
          />
        </div>
        <div className="subtle" style={{ maxWidth: 270 }}>
          Түсірілген сектор: {sectors.length} ішінен {scannedIds.length}. Түсірілмегендері есепте сұр болып қалады — кейін толықтыруға болады.
        </div>
        {photoError && (
          <div style={{ font: "500 12.5px var(--font)", color: "var(--rec)", maxWidth: 270 }}>{photoError}</div>
        )}
        <PrimaryButton onClick={finishScan}>Есеп құру</PrimaryButton>
        {scannedIds.length < sectors.length && <button className="btn btn-ghost" onClick={() => setStep("scan_qr")}>Қалған секторларды түсіру</button>}
      </div>
    );
  }

  if (step === "scan_confirm") {
    return (
      <div style={{ height: "100dvh", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "var(--bg-shell-dark)", padding: "24px 24px 30px", color: "#fff" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 24, marginTop: 40 }}>
          <div style={{ font: "500 11px var(--mono)", letterSpacing: ".1em", textTransform: "uppercase", color: "var(--scan-line)" }}>● Белгі танылды</div>
          <div>
            <div style={{ font: "600 84px/1 var(--mono)", letterSpacing: "-0.04em", animation: "zd-pop .45s both" }}>{current?.label}</div>
            <div style={{ font: "500 22px var(--font-display)", marginTop: 8 }}>секторы</div>
            <div style={{ font: "400 14px/1.6 var(--font)", color: "rgba(255,255,255,.6)", marginTop: 12, maxWidth: 280 }}>
              {current?.plant_count} түп
            </div>
          </div>
          <div style={{ borderLeft: "2px solid var(--scan-line)", padding: "4px 0 4px 14px", font: "400 13px/1.6 var(--font)", color: "rgba(255,255,255,.75)" }}>
            Енді кемінде {DEFAULT_MIN_PHOTOS} фото түсіресіз (ең көбі {DEFAULT_MAX_PHOTOS}) — әр қадамда не түсіру керегін көрсетеміз.
          </div>
        </div>
        <button className="btn btn-on-dark" onClick={() => setStep("scan_photos")}>Әрі қарай — түсіру</button>
      </div>
    );
  }

  // scan_photos
  if (step === "scan_photos") {
    const photoCount = shots.length;
    const minPhotos = DEFAULT_MIN_PHOTOS;
    const maxPhotos = DEFAULT_MAX_PHOTOS;
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
            {shots.map((p) => (
              <img
                key={p.clientId}
                src={p.url}
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

        {qualityPrompt && (
          <div style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(12,17,15,.7)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
            <div style={{ width: "100%", maxWidth: 430, background: "var(--bg-shell)", color: "var(--ink)", borderRadius: "16px 16px 0 0", padding: "18px 20px calc(env(safe-area-inset-bottom, 0px) + 22px)", display: "flex", flexDirection: "column", gap: 14, animation: "zd-rise .25s both" }}>
              <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                <img src={qualityPrompt.url} alt="" style={{ width: 64, height: 80, objectFit: "cover", borderRadius: 6, flex: "none" }} />
                <div>
                  <span className="badge badge-warn">Сапа</span>
                  <div className="title-serif" style={{ fontSize: 20, marginTop: 6 }}>{QUALITY_TEXT[qualityPrompt.issue].title}</div>
                </div>
              </div>
              <p className="subtle" style={{ fontSize: 14 }}>{QUALITY_TEXT[qualityPrompt.issue].body} Анық фото — дәлірек диагноз.</p>
              <PrimaryButton onClick={() => resolveQuality(false)}>Қайта түсіру</PrimaryButton>
              <button className="btn btn-ghost" onClick={() => resolveQuality(true)}>Осы фотоны қалдыру</button>
            </div>
          </div>
        )}
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
      <div style={{ padding: "0 20px" }}><QueueBanner dark /></div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22, padding: "0 26px" }}>
        <div style={{ width: 240, height: 240, borderRadius: 14, position: "relative", overflow: "hidden", background: "#161D1A" }}>
          <video ref={camera.videoRef} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          {[{ top: 14, left: 14 }, { top: 14, right: 14 }, { bottom: 14, left: 14 }, { bottom: 14, right: 14 }].map((pos, i) => (
            <span key={i} style={{
              position: "absolute", ...pos, width: 30, height: 30, borderColor: "var(--scan-line)", borderStyle: "solid", borderWidth: 0,
              ...(pos.top != null ? { borderTopWidth: 2 } : { borderBottomWidth: 2 }), ...(pos.left != null ? { borderLeftWidth: 2 } : { borderRightWidth: 2 }),
            }} />
          ))}
          <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 2, background: "var(--scan-line)", boxShadow: "0 0 14px var(--scan-line)", animation: "gg-scanline 1.8s ease-in-out infinite alternate" }} />
        </div>
        <div style={{ font: "500 22px/1.25 var(--font-display)", textAlign: "center" }}>Қатардағы QR белгіге бағыттаңыз</div>
        <div className="subtle" style={{ color: "rgba(255,255,255,.55)", textAlign: "center", maxWidth: 250 }}>
          Қалғаны: {sectors.length - scannedIds.length} сектор. Реті маңызды емес — жүйе белгі арқылы өзі таниды.
        </div>
      </div>
      <div style={{ padding: "18px 20px 30px", display: "flex", flexDirection: "column", gap: 10 }}>
        {photoError && (
          <div style={{ font: "500 12.5px var(--font)", color: "var(--rec)", textAlign: "center" }}>{photoError}</div>
        )}
        <button className="btn btn-on-dark" onClick={() => setPicking(true)}>Секторды картадан таңдау</button>
        {scannedIds.length > 0 && <button className="btn btn-outline-on-dark" onClick={() => setStep("scan_done")}>Аяқтау — есеп құру</button>}
      </div>

      {picking && (
        <div onClick={() => setPicking(false)} style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(12,17,15,.6)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 430, background: "var(--bg-shell)", color: "var(--ink)", borderRadius: "16px 16px 0 0",
              padding: "18px 20px calc(env(safe-area-inset-bottom, 0px) + 22px)", display: "flex", flexDirection: "column", gap: 14,
              animation: "zd-rise .25s both",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div className="title-serif" style={{ fontSize: 20 }}>Қай сектор?</div>
              <button className="icon-btn" onClick={() => setPicking(false)} aria-label="Жабу">✕</button>
            </div>
            <GreenhouseMap
              rows={groupRows(sectors).map((row) => row.map((sec) => {
                const done = scannedIds.includes(sec.id);
                return { key: sec.id, label: sec.label, tag: done ? "ok" : "unscanned", tagLabel: done ? "түсірілді" : "таңдау", onClick: done ? undefined : () => pickSector(sec) };
              }))}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function groupRows(sectors) {
  const rows = [];
  let current = null;
  for (const s of sectors) {
    if (s.row !== current) {
      rows.push([]);
      current = s.row;
    }
    rows[rows.length - 1].push(s);
  }
  return rows;
}
