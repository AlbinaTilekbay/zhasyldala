import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import AppShell from "../components/AppShell";
import { GreenhouseMap, MapLegend, SectionHead, SeverityBadge, Spinner, StatusRuler, formatKkDate } from "../components/ui";

// Public, read-only report opened from a share link (/s/<token>) — what
// an agronomist sees. No account, no navigation into the farmer's app.
export default function SharedReport() {
  const { token } = useParams();
  const [report, setReport] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.publicGet(`/api/shared/${token}/`).then(setReport).catch(() => setError(true));
  }, [token]);

  async function pdf() {
    const blob = await api.publicGet(`/api/shared/${token}/pdf/`);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "zhasyldala-esep.pdf";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  if (error) {
    return (
      <AppShell>
        <div className="screen-pad" style={{ minHeight: "80dvh", justifyContent: "center" }}>
          <h1 className="title-lg" style={{ margin: 0 }}>Есеп табылмады</h1>
          <p className="subtle">Сілтеме қате немесе есеп жойылған. Жіберушіден жаңа сілтеме сұраңыз.</p>
        </div>
      </AppShell>
    );
  }
  if (!report) return <AppShell><div style={{ display: "flex", justifyContent: "center", paddingTop: 120 }}><Spinner /></div></AppShell>;

  const findings = report.rows.flat().filter((c) => c.tag === "bad" || c.tag === "warn");
  return (
    <AppShell>
      <div className="screen-pad-tight" style={{ paddingTop: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ font: "600 15px var(--font-display)" }}>Zhasyl<span style={{ color: "var(--accent)" }}>Dala</span></span>
          <span className="eyebrow">агрономға арналған есеп</span>
        </div>
        <div>
          <div className="eyebrow">{report.greenhouse_name}{report.crop_name ? ` · ${report.crop_name}` : ""}</div>
          <h1 className="title-lg" style={{ margin: "4px 0 0" }}>Шолу · {formatKkDate(report.started_at, { withYear: true })}</h1>
          <p className="subtle" style={{ marginTop: 6 }}>{report.scanned_count}/{report.total_sectors} сектор тексерілді</p>
        </div>
        <StatusRuler counts={report.counts} />
        <SectionHead no={1} title="Жылыжай картасы" />
        <GreenhouseMap rows={report.rows.map((row) => row.map((c) => ({ key: c.sector_id, label: c.label, tag: c.tag })))} />
        <MapLegend tags={["ok", "warn", "bad", "unknown", "unscanned"].filter((t) => report.counts[t])} />
        <SectionHead no={2} title="Табылғаны" aside={findings.length} />
        {findings.length ? (
          <div className="ledger">
            {findings.map((c) => (
              <div key={c.sector_id} className="ledger-row">
                <span className="mono" style={{ width: 34, fontWeight: 600 }}>{c.label}</span>
                <span style={{ flex: 1 }}>
                  <span style={{ display: "block", font: "600 14px var(--font)" }}>{c.diagnosis_disease || "—"}</span>
                  <span style={{ display: "block", font: "400 12px var(--font)", color: "var(--ink-mute)" }}>
                    {c.plants} түп{c.confidence ? ` · сенімділік ${Math.round(c.confidence * 100)}%` : ""}
                  </span>
                </span>
                <SeverityBadge severity={c.tag} />
              </div>
            ))}
          </div>
        ) : <div className="note">Бұл шолуда ауру табылмады.</div>}
        <button className="btn btn-ghost" onClick={pdf}>PDF жүктеу</button>
        <div style={{ font: "400 11.5px/1.5 var(--font)", color: "var(--ink-mute)" }}>
          Диагнозды ИИ жасады (фото бойынша). Емдеу шешімін қабылдамас бұрын тексеріңіз.
        </div>
      </div>
    </AppShell>
  );
}
