import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import AppShell from "../components/AppShell";
import BottomTabBar from "../components/BottomTabBar";
import { TopBar } from "../components/TopBar";
import { PrimaryButton } from "../components/ui";

const TAG_STYLE = {
  ok: { bg: "var(--accent-tint-strong)", bd: "rgba(15,118,110,.22)", fg: "var(--accent)", tag: "қалыпты" },
  warn: { bg: "var(--warn-tint-strong)", bd: "rgba(176,122,18,.28)", fg: "var(--warn-ink)", tag: "қауіп" },
  bad: { bg: "#F7DED7", bd: "rgba(180,64,46,.3)", fg: "var(--bad-ink)", tag: "ауру" },
  unscanned: { bg: "var(--unscanned-tint)", bd: "rgba(20,32,30,.08)", fg: "var(--unscanned-ink)", tag: "түсірілмеген" },
};

const LEGEND = [
  { tag: "ok", label: "қалыпты", color: "#CDE6E1" },
  { tag: "warn", label: "қауіп", color: "#F2DFB4" },
  { tag: "bad", label: "ауру", color: "#F0C8BE" },
  { tag: "unscanned", label: "түсірілмеген", color: "#E7E9E8" },
];

export default function Report() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get(`/api/scan-sessions/${sessionId}/report/`).then(setReport);
  }, [sessionId]);

  async function generatePlan() {
    setBusy(true);
    try {
      await api.post("/api/plans/generate/", { scan_session: Number(sessionId) });
      navigate(`/app/plan/${sessionId}`);
    } finally {
      setBusy(false);
    }
  }

  if (!report) return <AppShell tabs={<BottomTabBar />}><div className="screen-pad-tight">Жүктелуде…</div></AppShell>;

  const hasFindings = report.counts.warn > 0 || report.counts.bad > 0;

  return (
    <AppShell tabs={<BottomTabBar />}>
      <div className="screen-pad-tight">
        <TopBar to="/app" title="Жылыжай есебі" subtitle={new Date().toLocaleDateString("kk-KZ")} />
        <div style={{ display: "flex", gap: 8 }}>
          <StatBox value={report.counts.ok} label="қалыпты" bg="var(--accent-tint)" fg="var(--accent)" />
          <StatBox value={report.counts.warn} label="қауіп" bg="var(--warn-tint)" fg="var(--warn-ink)" />
          <StatBox value={report.counts.bad} label="ауру" bg="var(--bad-tint)" fg="var(--bad-ink)" />
        </div>
        <div className="sector-grid">
          {report.rows.map((row, i) => (
            <div className="sector-row" key={i}>
              {row.map((cell) => {
                const style = TAG_STYLE[cell.tag];
                return (
                  <button
                    key={cell.sector_id}
                    className="sector-cell"
                    style={{ background: style.bg, borderColor: style.bd, color: style.fg }}
                    onClick={() => navigate(`/app/report/${sessionId}/sector/${cell.sector_id}`)}
                  >
                    <div className="label">{cell.label}</div>
                    <div className="tag">{style.tag}</div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", font: "500 11.5px var(--font)", color: "var(--ink-mute)" }}>
          {LEGEND.map((l) => (
            <div key={l.tag} style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: l.color }} />
              {l.label}
            </div>
          ))}
        </div>
        {hasFindings && (
          <PrimaryButton onClick={generatePlan} disabled={busy}>
            {busy ? "Құрылуда…" : "Емдеу жоспарын құру"}
          </PrimaryButton>
        )}
      </div>
    </AppShell>
  );
}

function StatBox({ value, label, bg, fg }) {
  return (
    <div style={{ flex: 1, background: bg, borderRadius: 14, padding: "11px 12px" }}>
      <div style={{ font: "800 19px var(--font)", color: fg }}>{value}</div>
      <div style={{ font: "500 11px var(--font)", color: "var(--ink-mute)" }}>{label}</div>
    </div>
  );
}
