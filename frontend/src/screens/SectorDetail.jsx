import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, mediaUrl } from "../api/client";
import AppShell from "../components/AppShell";
import BottomTabBar from "../components/BottomTabBar";
import { TopBar } from "../components/TopBar";
import { BulletList, NumberedList, PrimaryButton } from "../components/ui";

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

        {detail.frame_image && (
          <div style={{ display: "flex", gap: 9 }}>
            <img
              src={mediaUrl(detail.frame_image)}
              alt=""
              style={{ flex: 1, height: 104, borderRadius: 14, objectFit: "cover" }}
            />
          </div>
        )}

        {detail.symptoms.length > 0 && (
          <div className="card card-lg">
            <div style={{ font: "700 14px var(--font)", marginBottom: 11 }}>Жүйе не көрді</div>
            <BulletList items={detail.symptoms} />
          </div>
        )}

        {detail.recommendations.length > 0 && (
          <div className="card card-lg">
            <div style={{ font: "700 14px var(--font)", marginBottom: 11 }}>Кеңестер</div>
            <NumberedList items={detail.recommendations} />
          </div>
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
