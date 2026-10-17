import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, mediaUrl } from "../api/client";
import AppShell from "../components/AppShell";
import BottomTabBar from "../components/BottomTabBar";
import { TopBar } from "../components/TopBar";
import {
  AiNarrative, BulletList, NumberedList, PrimaryButton, SectionHead, SeverityBadge, Spinner, formatKkDate, narrativeHasCards,
} from "../components/ui";

const RANK = { ok: 0, warn: 1, bad: 2 };

// "Дейін / кейін": the same sector last walkthrough vs. now, side by side,
// with a one-line verdict — did the treatment work?
function BeforeAfter({ previous, current }) {
  const before = RANK[previous.tag];
  const after = RANK[current.tag];
  let verdict = null;
  if (before != null && after != null) {
    if (after < before) verdict = { text: "Жақсарды — ем әсер етіп жатыр", color: "var(--accent)" };
    else if (after > before) verdict = { text: "Нашарлады — шараны күшейту керек", color: "var(--bad-ink)" };
    else if (after === 0) verdict = { text: "Тұрақты — сау күйінде", color: "var(--accent)" };
    else verdict = { text: "Өзгеріс жоқ — емді жалғастырыңыз", color: "var(--warn-ink)" };
  }
  const col = (label, date, tag, name, photo) => (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
      <span className="eyebrow">{label} · {date}</span>
      <div style={{ aspectRatio: "4 / 5", borderRadius: 8, overflow: "hidden", background: "var(--unscanned-tint)" }}>
        {photo && <img src={mediaUrl(photo)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />}
      </div>
      <SeverityBadge severity={tag} />
      {name && <span style={{ font: "500 12px/1.35 var(--font)", color: "var(--ink-soft)" }}>{name}</span>}
    </div>
  );
  const pick = (photos, affected = []) => (photos.find((p) => affected.includes(p.position)) || photos[0])?.url;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        {col("Дейін", formatKkDate(previous.started_at), previous.tag, previous.diagnosis_name, pick(previous.photos))}
        <span style={{ alignSelf: "center", color: "var(--ink-faint)", font: "500 18px var(--mono)" }}>→</span>
        {col("Кейін", "қазір", current.tag, current.diagnosis_name, pick(current.photos || [], current.ai_narrative?.affected_photos || []))}
      </div>
      {verdict && <div className="note" style={{ borderColor: verdict.color, color: verdict.color, fontWeight: 600 }}>{verdict.text}</div>}
    </div>
  );
}

const TONE = { ok: "var(--accent)", warn: "var(--warn-ink)", bad: "var(--bad-ink)", unscanned: "var(--ink-mute)", unknown: "var(--ink-mute)" };

export default function SectorDetail() {
  const { sessionId, sectorId } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState(null); // photo shown full-screen
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get(`/api/scan-sessions/${sessionId}/sectors/${sectorId}/`).then(setDetail).catch(() => setError("Сектор жүктелмеді."));
  }, [sessionId, sectorId]);

  async function generatePlan() {
    setBusy(true);
    try {
      await api.post("/api/plans/generate/", { scan_session: Number(sessionId) });
      navigate(`/app/plan/${sessionId}`);
    } catch (err) {
      setError(err?.message || "Жоспар құрылмады.");
    } finally {
      setBusy(false);
    }
  }

  if (!detail) {
    return (
      <AppShell tabs={<BottomTabBar />}>
        <div className="screen-pad-tight">
          <TopBar to={`/app/report/${sessionId}`} title="Сектор" />
          {error ? <div className="form-error">{error}</div> : <div style={{ display: "flex", justifyContent: "center", paddingTop: 80 }}><Spinner /></div>}
        </div>
      </AppShell>
    );
  }

  // 1-based photo positions OpenAI flagged as actually showing the
  // problem (apps/ml/openai_vision.py affected_photos) — empty when the
  // sector's healthy or only 1 photo was taken.
  const affectedSet = new Set(detail.ai_narrative?.affected_photos || []);
  const hasCards = narrativeHasCards(detail.ai_narrative);
  let no = 1;

  return (
    <AppShell tabs={<BottomTabBar />}>
      <div className="screen-pad-tight">
        <TopBar to={`/app/report/${sessionId}`} subtitle="Есепке оралу" title="" />

        <div className="rise" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span className="mono" style={{ font: "700 13px var(--mono)", padding: "3px 7px", border: "1px solid var(--ink-hairline)", borderRadius: 5 }}>
              {detail.sector.label}
            </span>
            <SeverityBadge severity={detail.tag} />
            <span className="eyebrow">{detail.sector.plants} түп</span>
          </div>
          <h1 className="title-lg" style={{ margin: 0, color: detail.tag === "ok" ? "var(--ink)" : TONE[detail.tag] }}>
            {detail.diagnosis_name || "Деректер жоқ"}
          </h1>
          {detail.meta && <div className="mono" style={{ fontSize: 12, color: "var(--ink-mute)" }}>{detail.meta}</div>}
        </div>

        {detail.photos?.length > 0 && (
          <div>
            <div style={{ display: "flex", gap: 8, overflowX: "auto", margin: "0 -20px", padding: "6px 20px 2px" }}>
              {detail.photos.map((p) => {
                const affected = affectedSet.has(p.position);
                return (
                  <button
                    key={p.id}
                    onClick={() => setZoom(p)}
                    style={{ position: "relative", flex: "none", padding: 0, border: 0, background: "none", cursor: "zoom-in" }}
                  >
                    <img
                      src={mediaUrl(p.url)}
                      alt={`${p.position}-фото`}
                      style={{
                        width: 96, height: 120, borderRadius: 8, objectFit: "cover", display: "block",
                        outline: affected ? "2px solid var(--bad)" : "1px solid var(--ink-hairline)", outlineOffset: affected ? 2 : -1,
                      }}
                    />
                    <span
                      className="mono"
                      style={{
                        position: "absolute", left: 6, bottom: 6, padding: "2px 5px", borderRadius: 4, fontSize: 10, fontWeight: 600,
                        background: affected ? "var(--bad)" : "rgba(16,21,18,.6)", color: "#fff",
                      }}
                    >
                      {String(p.position).padStart(2, "0")}{affected ? " · белгі" : ""}
                    </span>
                  </button>
                );
              })}
            </div>
            {affectedSet.size > 0 && (
              <div style={{ font: "500 12.5px var(--font)", color: "var(--bad-ink)", marginTop: 10 }}>
                Ауру белгісі {affectedSet.size > 1 ? `${affectedSet.size} фотода` : "белгіленген фотода"} көрінеді. Үлкейту үшін басыңыз.
              </div>
            )}
          </div>
        )}

        {detail.previous && detail.scanned && (
          <>
            <SectionHead no={no++} title="Дейін / кейін" aside="алдыңғы шолумен" />
            <BeforeAfter previous={detail.previous} current={detail} />
          </>
        )}

        {detail.symptoms.length > 0 && (
          <>
            <SectionHead no={no++} title="Жүйе не көрді" />
            <BulletList items={detail.symptoms} />
          </>
        )}

        {hasCards ? (
          <AiNarrative narrative={detail.ai_narrative} startNo={no} />
        ) : (
          detail.recommendations.length > 0 && (
            <>
              <SectionHead no={no++} title="Кеңестер" />
              <NumberedList items={detail.recommendations} />
            </>
          )
        )}

        {!detail.scanned && (
          <div className="empty-slot">
            Бұл сектор осы шолуда түсірілмеді. Келесі шолуда оның QR белгісін сканерлеп, 3 фото түсіріңіз.
            <PrimaryButton onClick={() => navigate("/app/scan")}>Шолуды бастау</PrimaryButton>
          </div>
        )}

        {error && <div className="form-error">{error}</div>}
        {(detail.tag === "warn" || detail.tag === "bad") && (
          <PrimaryButton onClick={generatePlan} disabled={busy}>{busy ? "Құрылуда…" : "Емдеу жоспарын құру"}</PrimaryButton>
        )}
      </div>

      {zoom && (
        <div
          onClick={() => setZoom(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 50, background: "rgba(12,17,15,.92)", display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", padding: 20, gap: 14, animation: "zd-rise .2s both",
          }}
        >
          <img src={mediaUrl(zoom.url)} alt="" style={{ maxWidth: "100%", maxHeight: "78dvh", borderRadius: 10, objectFit: "contain" }} />
          <span className="mono" style={{ color: "rgba(255,255,255,.7)", fontSize: 12 }}>
            {detail.sector.label} · {String(zoom.position).padStart(2, "0")}-фото{affectedSet.has(zoom.position) ? " · ауру белгісі" : ""} — жабу үшін басыңыз
          </span>
        </div>
      )}
    </AppShell>
  );
}
