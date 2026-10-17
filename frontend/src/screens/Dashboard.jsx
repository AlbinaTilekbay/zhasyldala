import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import AppShell from "../components/AppShell";
import BottomTabBar from "../components/BottomTabBar";
import DiseaseTimeline from "../components/DiseaseTimeline";
import QueueBanner from "../components/QueueBanner";
import {
  ArrowIcon, CheckBox, GreenhouseMap, PrimaryButton, SectionHead, Spinner, StatusRuler,
  daysAgoKk, formatKkDate,
} from "../components/ui";
import { useAuthStore } from "../store/useAuthStore";

// Headline + accent per overall state. Written as a sentence a farmer
// would say, not a status code.
function headline(counts, hasReport) {
  if (!hasReport) return { text: "Алғашқы шолуды бастаңыз", tone: "var(--ink)" };
  if (counts.bad) return { text: `${counts.bad} секторда ауру табылды`, tone: "var(--bad-ink)" };
  if (counts.warn) return { text: `${counts.warn} секторда қауіп бар`, tone: "var(--warn-ink)" };
  // Don't call the whole greenhouse healthy off a partial walk-through.
  if (!counts.ok && counts.unknown) return { text: "Фотолар талданбады", tone: "var(--ink-mute)" };
  if (counts.unscanned || counts.unknown) return { text: "Тексерілгені сау", tone: "var(--accent)" };
  return { text: "Жылыжай сау", tone: "var(--accent)" };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const userInitials = useAuthStore((s) => s.user?.initials || "—");
  const [loaded, setLoaded] = useState(false);
  const [greenhouse, setGreenhouse] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [report, setReport] = useState(null);
  const [plan, setPlan] = useState(null);
  const [planBusy, setPlanBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const greenhouses = await api.get("/api/greenhouses/");
        const gh = (greenhouses.results || greenhouses)[0];
        setGreenhouse(gh || null);
        if (!gh) return;

        const allSessions = await api.get("/api/scan-sessions/");
        const mine = (allSessions.results || allSessions)
          .filter((s) => s.greenhouse === gh.id && s.status === "done")
          .sort((a, b) => new Date(b.started_at) - new Date(a.started_at));
        setSessions(mine);

        const latest = mine[0];
        if (latest) {
          const [rep, plans] = await Promise.all([
            api.get(`/api/scan-sessions/${latest.id}/report/`),
            api.get("/api/plans/"),
          ]);
          setReport(rep);
          setPlan((plans.results || plans).find((p) => p.scan_session === latest.id) || null);
        }
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  async function createPlan() {
    setPlanBusy(true);
    try {
      await api.post("/api/plans/generate/", { scan_session: sessions[0].id });
      navigate(`/app/plan/${sessions[0].id}`);
    } finally {
      setPlanBusy(false);
    }
  }

  if (!loaded) {
    return (
      <AppShell tabs={<BottomTabBar />}>
        <div style={{ minHeight: "70dvh", display: "flex", alignItems: "center", justifyContent: "center" }}><Spinner /></div>
      </AppShell>
    );
  }

  if (!greenhouse) {
    return (
      <AppShell tabs={<BottomTabBar />}>
        <div className="screen-pad-tight" style={{ paddingTop: 40 }}>
          <h1 className="title-lg" style={{ margin: 0 }}>Жылыжай әлі қосылмаған</h1>
          <p className="subtle">Секторлар мен QR белгілерді баптап алыңыз — бар болғаны 2 минут.</p>
          <PrimaryButton onClick={() => navigate("/register")}>Жылыжайды баптау</PrimaryButton>
        </div>
      </AppShell>
    );
  }

  const latest = sessions[0];
  const counts = report?.counts || { ok: 0, warn: 0, bad: 0, unscanned: greenhouse.sectors.length };
  const hasFindings = counts.bad > 0 || counts.warn > 0;
  const head = headline(counts, Boolean(report));
  const mapRows = report
    ? report.rows.map((row) => row.map((c) => ({ key: c.sector_id, label: c.label, tag: c.tag })))
    : groupSectors(greenhouse.sectors).map((row) => row.map((s) => ({ key: s.id, label: s.label, tag: "unscanned" })));

  return (
    <AppShell tabs={<BottomTabBar />}>
      <div className="screen-pad-tight">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div className="eyebrow" style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {greenhouse.name} · {greenhouse.crop?.name || "дақыл таңдалмаған"}
          </div>
          <button className="avatar-circle" style={{ width: 36, height: 36, border: 0 }} onClick={() => navigate("/app/profile")}>
            {userInitials}
          </button>
        </div>

        <QueueBanner />

        <div className="rise">
          <h1 className="title-lg" style={{ margin: 0, color: head.tone }}>{head.text}</h1>
          <p className="subtle" style={{ marginTop: 6 }}>
            {latest
              ? `Соңғы шолу — ${formatKkDate(latest.started_at)} (${daysAgoKk(latest.started_at)}), ${report?.scanned_count ?? latest.captures.length}/${greenhouse.sectors.length} сектор түсірілді.`
              : `${greenhouse.sectors.length} сектор дайын. QR белгілерді іліп, телефонмен аралап шығыңыз.`}
          </p>
        </div>

        {report && <div className="rise" style={{ animationDelay: ".08s" }}><StatusRuler counts={counts} /></div>}

        <button
          onClick={() => report && navigate(`/app/report/${latest.id}`)}
          style={{ background: "none", border: 0, padding: 0, textAlign: "left", cursor: report ? "pointer" : "default" }}
          aria-label="Жылыжай картасы"
        >
          <GreenhouseMap rows={mapRows} compact />
        </button>

        <PrimaryButton onClick={() => navigate("/app/scan")}>
          {latest ? "Жаңа шолу бастау" : "Алғашқы шолуды бастау"}
        </PrimaryButton>

        <SectionHead no={1} title="Емдеу жоспары" aside={plan ? `${plan.done_count}/${plan.total_count}` : null} />
        {plan ? (
          <div className="ledger">
            {plan.items.slice(0, 3).map((item) => (
              <div key={item.id} className="ledger-row">
                <CheckBox on={item.done} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: "600 14px var(--font)", textDecoration: item.done ? "line-through" : "none", color: item.done ? "var(--ink-faint)" : "var(--ink)" }}>
                    {item.title}
                  </div>
                  <div className="mono" style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 3 }}>
                    {item.when_label} · {item.where_label}
                  </div>
                </div>
              </div>
            ))}
            <button className="ledger-row" onClick={() => navigate(`/app/plan/${plan.scan_session}`)} style={{ color: "var(--accent)", font: "600 13.5px var(--font)", cursor: "pointer" }}>
              <span style={{ flex: 1 }}>Толық жоспар</span>
              <ArrowIcon className="ledger-go" />
            </button>
          </div>
        ) : hasFindings ? (
          <div className="empty-slot">
            <span>Соңғы шолуда {counts.bad + counts.warn} проблемалы сектор бар. Апталық емдеу жоспарын құрайық — не, қашан, қай секторда.</span>
            <PrimaryButton onClick={createPlan} disabled={planBusy}>{planBusy ? "Құрылуда…" : "Жоспар құру"}</PrimaryButton>
          </div>
        ) : (
          <div className="empty-slot">
            {report ? "Ауру табылмады — жоспар қажет емес. Күтімді жалғастырыңыз." : "Жоспар алғашқы шолудан кейін, ауру табылса пайда болады."}
          </div>
        )}

        {sessions.length >= 2 && (
          <>
            <SectionHead no={2} title="Аурудың таралуы" aside={`${Math.min(sessions.length, 12)} апта`} />
            <DiseaseTimeline greenhouseId={greenhouse.id} />
          </>
        )}

        <SectionHead no={sessions.length >= 2 ? 3 : 2} title="Шолулар тарихы" aside={sessions.length || null} />
        {sessions.length ? (
          <div className="ledger">
            {sessions.map((s) => (
              <button key={s.id} className="ledger-row" style={{ cursor: "pointer" }} onClick={() => navigate(`/app/report/${s.id}`)}>
                <span className="mono" style={{ width: 74, fontSize: 12.5, fontWeight: 600 }}>{formatKkDate(s.started_at)}</span>
                <span style={{ flex: 1, font: "400 13px var(--font)", color: "var(--ink-mute)" }}>{s.captures.length} сектор түсірілді</span>
                <ArrowIcon className="ledger-go" />
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-slot">Әзірге шолу болмады. Бірінші шолудан кейін мұнда әр аптаның нәтижесі сақталады.</div>
        )}
      </div>
    </AppShell>
  );
}

function groupSectors(sectors) {
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
