import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, mediaUrl } from "../api/client";
import AppShell from "../components/AppShell";
import BottomTabBar from "../components/BottomTabBar";
import { TopBar } from "../components/TopBar";
import { AiNarrative, BulletList, NumberedList, PrimaryButton, narrativeHasCards } from "../components/ui";

const TAG_STYLE = {
  ok: { bg: "var(--accent-tint)", bd: "rgba(15,118,110,.18)", fg: "var(--accent)" },
  warn: { bg: "var(--warn-tint)", bd: "rgba(176,122,18,.2)", fg: "var(--warn-ink)" },
  bad: { bg: "var(--bad-tint)", bd: "rgba(180,64,46,.2)", fg: "var(--bad-ink)" },
  unscanned: { bg: "var(--unscanned-tint)", bd: "rgba(20,32,30,.08)", fg: "var(--unscanned-ink)" },
};

export default function SectorDetail() {
  const { sessionId, sectorId } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get(`/api/scan-sessions/${sessionId}/sectors/${sectorId}/`).then(setDetail);
  }, [sessionId, sectorId]);

  async function generatePlan() {
    setBusy(true);
    try {
      await api.post("/api/plans/generate/", { scan_session: Number(sessionId) });
      navigate(`/app/plan/${sessionId}`);
    } finally {
      setBusy(false);
    }
  }

  if (!detail) return <AppShell tabs={<BottomTabBar />}><div className="screen-pad-tight">Жүктелуде…</div></AppShell>;

  const style = TAG_STYLE[detail.tag] || TAG_STYLE.unscanned;
  // 1-based photo positions OpenAI flagged as actually showing the
  // problem, out of this sector's full photo set (apps/ml/openai_vision.py
  // affected_photos) — empty when the sector's healthy or only 1 photo
  // was taken (per-photo attribution isn't meaningful for a single shot).
  const affectedSet = new Set(detail.ai_narrative?.affected_photos || []);

  return (
    <AppShell tabs={<BottomTabBar />}>
      <div className="screen-pad-tight">
        <TopBar to={`/app/report/${sessionId}`} subtitle={`${detail.sector.plants} түп`} title={`${detail.sector.label} секторы`} />

        <div className="card card-lg" style={{ background: style.bg, borderColor: style.bd, display: "flex", flexDirection: "column", gap: 7 }}>
          <div style={{ font: "700 11px var(--font)", letterSpacing: ".06em", textTransform: "uppercase", color: style.fg }}>
            {detail.status_text}
          </div>
          <div style={{ font: "800 21px/1.2 var(--font)" }}>{detail.diagnosis_name || "Деректер жоқ"}</div>
          {detail.meta && <div style={{ font: "500 12.5px var(--font)", color: "var(--ink-soft)" }}>{detail.meta}</div>}
        </div>

        {detail.photos?.length > 0 && (
          <div>
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
              {detail.photos.map((p) => {
                const affected = affectedSet.has(p.position);
                return (
                  <div key={p.id} style={{ position: "relative", flex: "none" }}>
                    <img
                      src={mediaUrl(p.url)}
                      alt=""
                      style={{
                        width: 84, height: 84, borderRadius: 14, objectFit: "cover",
                        border: affected ? "2px solid var(--bad-ink)" : "1px solid rgba(20,32,30,.1)",
                      }}
                    />
                    {affected && (
                      <div
                        style={{
                          position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%",
                          background: "var(--bad-ink)", color: "#fff", display: "flex", alignItems: "center",
                          justifyContent: "center", font: "700 12px var(--font)",
                        }}
                      >
                        !
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {affectedSet.size > 0 && (
              <div style={{ font: "500 12px var(--font)", color: "var(--bad-ink)", marginTop: 8 }}>
                Ауру белгісі {affectedSet.size > 1 ? `${affectedSet.size} фотода` : "жоғарыдағы фотода"} байқалды (қызыл жиек).
              </div>
            )}
          </div>
        )}

        {detail.symptoms.length > 0 && (
          <div className="card card-lg">
            <div style={{ font: "700 14px var(--font)", marginBottom: 11 }}>Жүйе не көрді</div>
            <BulletList items={detail.symptoms} />
          </div>
        )}

        {narrativeHasCards(detail.ai_narrative) ? (
          <AiNarrative narrative={detail.ai_narrative} />
        ) : (
          detail.recommendations.length > 0 && (
            <div className="card card-lg">
              <div style={{ font: "700 14px var(--font)", marginBottom: 11 }}>Кеңестер</div>
              <NumberedList items={detail.recommendations} />
            </div>
          )
        )}

        {(detail.tag === "warn" || detail.tag === "bad") && (
          <PrimaryButton onClick={generatePlan} disabled={busy}>
            {busy ? "Құрылуда…" : "Емдеу жоспарын құру"}
          </PrimaryButton>
        )}
      </div>
    </AppShell>
  );
}
