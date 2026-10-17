import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, mediaUrl } from "../../api/client";
import AppShell from "../../components/AppShell";
import { BackButton } from "../../components/TopBar";
import Analyzing from "../../components/Analyzing";
import { AiNarrative, BulletList, NumberedList, PrimaryButton, SectionHead, SeverityBadge, narrativeHasCards } from "../../components/ui";
import { useCamera } from "../../hooks/useCamera";
import { QUALITY_TEXT, checkPhotoQuality } from "../../offline/photoQuality";

// Ports the mockup's plant_capture -> plant_analyzing -> plant_result
// sequence as one local step machine (no backend state needed between
// steps — it's a single upload-and-wait action).
export default function HomePlantFlow() {
  const navigate = useNavigate();
  const [step, setStep] = useState("capture"); // capture | analyzing | result | error
  const [result, setResult] = useState(null);
  const [preview, setPreview] = useState(null); // object URL of the photo just taken
  const [qualityPrompt, setQualityPrompt] = useState(null); // {blob, url, issue} before sending
  const camera = useCamera();
  const pollRef = useRef(null);

  // (Re)start the camera whenever we're back on the capture step — after
  // the render, so the freshly mounted <video> gets the stream.
  useEffect(() => {
    if (step === "capture") camera.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  useEffect(() => () => camera.stop(), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => clearInterval(pollRef.current), []);

  async function pollUntilDone(requestId) {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      pollRef.current = setInterval(async () => {
        attempts += 1;
        try {
          const data = await api.publicGet(`/api/diagnose/${requestId}/`);
          if (data.status === "done") {
            clearInterval(pollRef.current);
            resolve(data);
          } else if (data.status === "failed" || attempts > 30) {
            clearInterval(pollRef.current);
            reject(new Error("Талдау сәтсіз аяқталды"));
          }
        } catch (err) {
          clearInterval(pollRef.current);
          reject(err);
        }
      }, 1000);
    });
  }

  async function handleCapture() {
    const blob = await camera.capturePhoto();
    if (!blob) return;
    const quality = await checkPhotoQuality(blob);
    if (quality.issue) {
      setQualityPrompt({ blob, url: URL.createObjectURL(blob), issue: quality.issue });
      return;
    }
    await analyze(blob);
  }

  async function resolveQuality(keep) {
    const prompt = qualityPrompt;
    setQualityPrompt(null);
    if (!prompt) return;
    URL.revokeObjectURL(prompt.url);
    if (keep) await analyze(prompt.blob);
  }

  async function analyze(blob) {
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(blob);
    });
    setStep("analyzing");
    camera.stop();
    try {
      const form = new FormData();
      form.append("image", blob, "leaf.jpg");
      const created = await api.publicPost("/api/diagnose/anonymous/", form, { isForm: true });
      const finished = created.status === "done" ? created : await pollUntilDone(created.id);
      setResult(finished);
      setStep("result");
    } catch {
      setStep("error");
    }
  }

  if (step === "capture") {
    return (
      <AppShell dark>
        <div style={{ height: "100%", display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
          <div style={{ padding: "6px 20px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <BackButton to="/role" dark />
            <div style={{ flex: 1, textAlign: "center", font: "500 11px var(--mono)", letterSpacing: ".08em", textTransform: "uppercase", color: "rgba(255,255,255,.7)" }}>Өсімдік суреті</div>
            <div style={{ width: 34 }} />
          </div>
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 20px" }}>
            <div
              style={{
                width: "100%", aspectRatio: "3/4", borderRadius: 14, overflow: "hidden", position: "relative",
                border: "1px solid rgba(255,255,255,.14)", background: "#161D1A",
              }}
            >
              <video ref={camera.videoRef} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <ViewfinderCorners />
              {!camera.ready && (
                <div
                  style={{
                    position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                    font: "500 11.5px var(--mono)", color: "rgba(255,255,255,.5)", textAlign: "center", lineHeight: 1.7,
                  }}
                >
                  {camera.error ? (
                    camera.error
                  ) : (
                    <>
                      камера қосылуда…
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          <div style={{ padding: "22px 20px 30px", display: "flex", flexDirection: "column", gap: 14, alignItems: "center" }}>
            <div style={{ font: "400 12.5px var(--font)", color: "rgba(255,255,255,.6)", textAlign: "center" }}>
              Дақ түскен жапырақты жақыннан, жарыққа қаратып түсіріңіз. Жарық артта болмасын.
            </div>
            <button
              onClick={handleCapture}
              disabled={!camera.ready}
              aria-label="Суретке түсіру"
              style={{ width: 76, height: 76, borderRadius: "50%", border: "5px solid rgba(255,255,255,.22)", background: "#fff", backgroundClip: "padding-box", opacity: camera.ready ? 1 : 0.4, transition: "transform .1s" }}
              onPointerDown={(e) => { e.currentTarget.style.transform = "scale(.92)"; }}
              onPointerUp={(e) => { e.currentTarget.style.transform = ""; }}
            />
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
                <button className="btn btn-ghost" onClick={() => resolveQuality(true)}>Осылай жіберу</button>
              </div>
            </div>
          )}
        </div>
      </AppShell>
    );
  }

  if (step === "analyzing") {
    return (
      <AppShell>
        <Analyzing photoUrl={preview} title="Сурет талданып жатыр" />
      </AppShell>
    );
  }

  if (step === "error") {
    return (
      <AppShell>
        <div className="screen-pad" style={{ minHeight: "100dvh", justifyContent: "center" }}>
          <div className="eyebrow" style={{ color: "var(--bad)" }}>Қате</div>
          <h1 className="title-lg" style={{ margin: 0 }}>Талдау аяқталмады</h1>
          <p className="subtle">Көбіне себебі — интернеттің әлсіздігі. Байланысты тексеріп, қайта түсіріп көріңіз.</p>
          <PrimaryButton onClick={() => { setStep("capture"); }}>Қайта түсіру</PrimaryButton>
        </div>
      </AppShell>
    );
  }

  const diag = result?.result;
  const disease = diag?.disease;
  const narrative = diag?.ai_narrative;
  // OpenAI vision results never map onto our local Disease knowledge base
  // — diag.disease is always null for them by design (see
  // apps/ml/openai_vision.py) — so the condition name/description it came
  // up with live in diag.ai_narrative instead. Reading only disease?.*
  // here, as this screen used to (before OpenAI vision existed), silently
  // threw that content away and always showed the generic "no disease
  // found" placeholder even when a full real answer came back.
  const isAiResult = diag?.source === "openai_vision";
  const showCards = narrativeHasCards(narrative);
  let adviceTitle = "Не істеу керек";
  let adviceItems = disease?.home_care_advice?.length
    ? disease.home_care_advice
    : diag?.recommendations?.length
      ? diag.recommendations
      : null;
  if (!adviceItems && diag?.symptoms_seen?.length) {
    // The narrative cards had nothing (model left cause/treatment blank),
    // but it did see something — show that instead of a content-free
    // generic message, under an honest heading rather than "what to do".
    adviceTitle = "Байқалған белгілер";
    adviceItems = diag.symptoms_seen;
  }
  if (!adviceItems) adviceItems = ["Күтімді жалғастырыңыз."];

  // source "rule" = nothing actually analysed the photo (no OpenAI key /
  // no internet, no trained model). Say so plainly instead of showing a
  // reassuring "healthy" result with a technical message.
  if (diag?.source === "rule") {
    return (
      <AppShell>
        <div className="screen-pad" style={{ minHeight: "100dvh", justifyContent: "center" }}>
          {preview && <img src={preview} alt="" style={{ width: 96, height: 120, objectFit: "cover", borderRadius: 8 }} />}
          <span className="badge badge-none" style={{ alignSelf: "flex-start" }}>Анықталмады</span>
          <h1 className="title-lg" style={{ margin: 0 }}>Суретті талдай алмадық</h1>
          <p className="subtle" style={{ fontSize: 14 }}>
            Талдау қызметіне қосылу мүмкін болмады — көбіне интернет әлсіз болғанда болады. Байланысты тексеріп, қайта түсіріп көріңіз.
          </p>
          <PrimaryButton onClick={() => { setResult(null); setStep("capture"); }}>Қайта түсіру</PrimaryButton>
        </div>
      </AppShell>
    );
  }

  const severity = diag?.severity || "ok";
  const tone = { ok: "var(--accent)", warn: "var(--warn-ink)", bad: "var(--bad-ink)" }[severity];
  const title = disease?.name || narrative?.condition_name || (isAiResult ? diag?.species_guess || "Нәтиже белгісіз" : "Ауру белгісі табылмады");
  const description = disease?.description || narrative?.description || (isAiResult ? "" : "Өсімдік қалыпты көрінеді.");

  return (
    <AppShell>
      <div className="screen-pad">
        <div className="topbar">
          <BackButton onClick={() => { setStep("capture"); }} />
          <div className="step-label" style={{ flex: 1 }}>Нәтиже</div>
        </div>
        <div className="rise" style={{ display: "grid", gridTemplateColumns: "96px 1fr", gap: 14, alignItems: "start" }}>
          <div style={{ width: 96, height: 120, borderRadius: 8, overflow: "hidden", background: "var(--unscanned-tint)" }}>
            {(result?.image || preview) && (
              <img src={result?.image ? mediaUrl(result.image) : preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <SeverityBadge severity={severity} />
              {diag?.confidence > 0 && <span className="mono" style={{ fontSize: 11, color: "var(--ink-mute)" }}>{Math.round(diag.confidence * 100)}%</span>}
            </div>
            <h1 className="title-serif" style={{ margin: 0, fontSize: 24, lineHeight: 1.15, color: severity === "ok" ? "var(--ink)" : tone }}>{title}</h1>
            {diag?.species_guess && title !== diag.species_guess && (
              <div className="mono" style={{ fontSize: 11.5, color: "var(--ink-mute)" }}>{diag.species_guess}</div>
            )}
          </div>
        </div>
        {description && <p className="subtle" style={{ fontSize: 14 }}>{description}</p>}
        {showCards ? (
          <AiNarrative narrative={narrative} />
        ) : (
          <>
            <SectionHead no={1} title={adviceTitle} />
            {adviceTitle === "Байқалған белгілер" ? <BulletList items={adviceItems} /> : <NumberedList items={adviceItems} />}
          </>
        )}
        <PrimaryButton onClick={() => { setResult(null); setStep("capture"); }}>Басқа өсімдікті тексеру</PrimaryButton>
        <div className="note" style={{ marginTop: 4 }}>
          Жылыжайыңыз бар ма? Тіркеліп, әр секторды апта сайын бақылаңыз — жүйе ауруды қай жерде басталғанын көрсетеді.
          <div><button className="btn-link" onClick={() => navigate("/register")}>Жылыжайды тіркеу</button></div>
        </div>
      </div>
    </AppShell>
  );
}

function ViewfinderCorners() {
  const base = { position: "absolute", width: 28, height: 28, borderColor: "rgba(255,255,255,.85)", borderStyle: "solid", borderWidth: 0 };
  return (
    <div style={{ position: "absolute", inset: 18, pointerEvents: "none" }}>
      <span style={{ ...base, top: 0, left: 0, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 6 }} />
      <span style={{ ...base, top: 0, right: 0, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 6 }} />
      <span style={{ ...base, bottom: 0, left: 0, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: 6 }} />
      <span style={{ ...base, bottom: 0, right: 0, borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: 6 }} />
    </div>
  );
}
