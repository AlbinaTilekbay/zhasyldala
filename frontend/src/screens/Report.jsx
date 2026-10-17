import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import AppShell from "../components/AppShell";
import ShareReport from "../components/ShareReport";
import BottomTabBar from "../components/BottomTabBar";
import { TopBar } from "../components/TopBar";
import {
  ArrowIcon, GreenhouseMap, MapLegend, PrimaryButton, SectionHead, SeverityBadge, Spinner, StatusRuler, formatKkDate,
} from "../components/ui";

export default function Report() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [session, setSession] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get(`/api/scan-sessions/${sessionId}/report/`).then(setReport).catch(() => setError("Есеп жүктелмеді."));
    api.get(`/api/scan-sessions/${sessionId}/`).then(setSession).catch(() => {});
  }, [sessionId]);

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

  if (!report) {
    return (
      <AppShell tabs={<BottomTabBar />}>
        <div className="screen-pad-tight">
          <TopBar to="/app" title="Жылыжай есебі" />
          {error ? <div className="form-error">{error}</div> : <div style={{ display: "flex", justifyContent: "center", paddingTop: 80 }}><Spinner /></div>}
        </div>
      </AppShell>
    );
  }

  const openSector = (id) => navigate(`/app/report/${sessionId}/sector/${id}`);
  const cells = report.rows.flat();
  const findings = cells.filter((c) => c.tag === "bad" || c.tag === "warn").sort((a, b) => (a.tag === "bad" ? -1 : 1) - (b.tag === "bad" ? -1 : 1));
  const mapRows = report.rows.map((row) => row.map((c) => ({ key: c.sector_id, label: c.label, tag: c.tag, onClick: () => openSector(c.sector_id) })));

  return (
    <AppShell tabs={<BottomTabBar />}>
      <div className="screen-pad-tight">
        <TopBar to="/app" subtitle={session ? `Шолу · ${formatKkDate(session.started_at, { withYear: true })}` : "Шолу"} title="Жылыжай есебі" />

        <div className="rise">
          <div className="title-lg">
            {report.scanned_count}<span style={{ color: "var(--ink-faint)" }}>/{report.total_sectors}</span> сектор тексерілді
          </div>
        </div>
        <StatusRuler counts={report.counts} />

        <SectionHead no={1} title="Жылыжай картасы" aside="секторды басыңыз" />
        <GreenhouseMap rows={mapRows} />
        <MapLegend tags={["ok", "warn", "bad", "unknown", "unscanned"].filter((t) => report.counts[t])} />

        {findings.length > 0 && (
          <>
            <SectionHead no={2} title="Назар аударыңыз" aside={findings.length} />
            <div className="ledger">
              {findings.map((c) => (
                <button key={c.sector_id} className="ledger-row" style={{ cursor: "pointer" }} onClick={() => openSector(c.sector_id)}>
                  <span className="mono" style={{ width: 34, fontWeight: 600, fontSize: 14 }}>{c.label}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", font: "600 14px var(--font)" }}>{c.diagnosis_disease || (c.tag === "bad" ? "Ауру белгісі" : "Қауіп белгісі")}</span>
                    <span style={{ display: "block", font: "400 12px var(--font)", color: "var(--ink-mute)", marginTop: 2 }}>
                      {c.plants} түп{c.confidence ? ` · сенімділік ${Math.round(c.confidence * 100)}%` : ""}
                    </span>
                  </span>
                  <SeverityBadge severity={c.tag} />
                  <ArrowIcon className="ledger-go" />
                </button>
              ))}
            </div>
            {error && <div className="form-error">{error}</div>}
            <PrimaryButton onClick={generatePlan} disabled={busy}>{busy ? "Құрылуда…" : "Емдеу жоспарын құру"}</PrimaryButton>
          </>
        )}
        {report.counts.unknown > 0 && (
          <div className="note" style={{ borderColor: "var(--ink-faint)" }}>
            {report.counts.unknown} сектордың фотолары талданбады (байланыс болмаған). Оларды келесі шолуда қайта түсіріңіз.
          </div>
        )}
        {findings.length === 0 && (
          <div className="note">
            {report.counts.unscanned > 0
              ? `Тексерілген секторларда ауру табылмады. Әлі ${report.counts.unscanned} сектор түсірілмеген — толық сурет үшін оларды да аралаңыз.`
              : "Бұл шолуда ауру да, қауіп те табылмады. Келесі шолуды 7 күннен кейін жасаңыз."}
          </div>
        )}

        <SectionHead no={findings.length > 0 ? 3 : 2} title="Агрономға жіберу" />
        <ShareReport sessionId={sessionId} dateLabel={session ? formatKkDate(session.started_at) : ""} />
      </div>
    </AppShell>
  );
}
