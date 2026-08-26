import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, mediaUrl } from "../../api/client";
import AppShell from "../../components/AppShell";
import { BackButton } from "../../components/TopBar";
import { AiNarrative, BulletList, NumberedList, PrimaryButton, SeverityBadge, Spinner, narrativeHasCards } from "../../components/ui";
import { useCamera } from "../../hooks/useCamera";

// Ports the mockup's plant_capture -> plant_analyzing -> plant_result
// sequence as one local step machine (no backend state needed between
// steps — it's a single upload-and-wait action).
export default function HomePlantFlow() {
  const navigate = useNavigate();
  const [step, setStep] = useState("capture"); // capture | analyzing | result | error
  const [result, setResult] = useState(null);
  const camera = useCamera();
  const pollRef = useRef(null);

  useEffect(() => {
    camera.start();
    return () => camera.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            <div style={{ flex: 1, textAlign: "center", font: "600 14px var(--font)", color: "#fff" }}>Өсімдік суреті</div>
            <div style={{ width: 34 }} />
          </div>
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 20px" }}>
            <div
              style={{
                width: "100%", aspectRatio: "3/4", borderRadius: 22, overflow: "hidden", position: "relative",
                border: "1px solid rgba(255,255,255,.14)", background: "#161D1A",
              }}
            >
              <video ref={camera.videoRef} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <div style={{ position: "absolute", inset: 22, border: "1.5px dashed rgba(255,255,255,.28)", borderRadius: 16 }} />
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
                      камера
                      <br />
                      жапырақты
                      <br />
                      тұтас түсіріңіз
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          <div style={{ padding: "22px 20px 30px", display: "flex", flexDirection: "column", gap: 14, alignItems: "center" }}>
            <div style={{ font: "400 12.5px var(--font)", color: "rgba(255,255,255,.6)", textAlign: "center" }}>
              Жарық артта болмасын. Дақ түскен жапырақты жақыннан түсіріңіз.
            </div>
            <button
              onClick={handleCapture}
              disabled={!camera.ready}
              style={{ width: 74, height: 74, borderRadius: "50%", border: "4px solid rgba(255,255,255,.3)", background: "#fff" }}
            />
          </div>
        </div>
      </AppShell>
    );
  }

  if (step === "analyzing") {
    return (
      <AppShell>
        <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, padding: 40, minHeight: "100dvh" }}>
          <Spinner />
          <div className="title-md">Сурет талданып жатыр</div>
          <div className="subtle" style={{ textAlign: "center", maxWidth: 240 }}>
            240 ауру мен қоректік зат тапшылығының базасымен салыстырылады
          </div>
        </div>
      </AppShell>
    );
  }

  if (step === "error") {
    return (
      <AppShell>
        <div className="screen-pad" style={{ minHeight: "100dvh", justifyContent: "center", alignItems: "center", textAlign: "center" }}>
          <div className="title-md">Талдау сәтсіз аяқталды</div>
          <p className="subtle">Интернет байланысын тексеріп, қайта көріңіз.</p>
          <PrimaryButton onClick={() => setStep("capture")}>Қайталау</PrimaryButton>
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

  return (
    <AppShell>
      <div className="screen-pad">
        <div className="topbar">
          <BackButton onClick={() => setStep("capture")} />
          <div className="title-md">Нәтиже</div>
        </div>
        <div className="card card-lg" style={{ padding: 0, overflow: "hidden" }}>
          <div className="placeholder-photo" style={{ height: 150 }}>
            {result?.image ? (
              <img src={mediaUrl(result.image)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              "жапырақ суреті"
            )}
          </div>
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <SeverityBadge severity={diag?.severity || "ok"} />
              <span style={{ font: "500 12px var(--font)", color: "var(--ink-mute)" }}>
                Сенімділік {Math.round((diag?.confidence || 0) * 100)}%
              </span>
            </div>
            <div style={{ font: "700 20px var(--font)" }}>
              {disease?.name || narrative?.condition_name || (isAiResult ? diag?.species_guess || "Нәтиже белгісіз" : "Ауру белгісі табылмады")}
            </div>
            <div className="subtle">
              {disease?.description || narrative?.description || (isAiResult ? (showCards ? "Толығырақ — төменде." : "") : "Өсімдік қалыпты көрінеді.")}
            </div>
          </div>
        </div>
        {showCards ? (
          <AiNarrative narrative={narrative} />
        ) : (
          <div className="card card-lg">
            <div style={{ font: "700 14px var(--font)", marginBottom: 12 }}>{adviceTitle}</div>
            {adviceTitle === "Байқалған белгілер" ? <BulletList items={adviceItems} /> : <NumberedList items={adviceItems} />}
          </div>
        )}
        <button className="btn btn-ghost" onClick={() => navigate("/register")}>
          Жылыжайым бар — секторларға өту
        </button>
      </div>
    </AppShell>
  );
}
