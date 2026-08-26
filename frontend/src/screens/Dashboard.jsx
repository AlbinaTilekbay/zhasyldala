import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import AppShell from "../components/AppShell";
import BottomTabBar from "../components/BottomTabBar";
import { PrimaryButton } from "../components/ui";
import { useAuthStore } from "../store/useAuthStore";

const STATUS_STYLE = {
  bad: { bg: "var(--bad-tint)", bd: "rgba(180,64,46,.2)", fg: "var(--bad-ink)", label: "Ауру табылды" },
  warn: { bg: "var(--warn-tint)", bd: "rgba(176,122,18,.2)", fg: "var(--warn-ink)", label: "Қауіп бар" },
  ok: { bg: "var(--accent-tint)", bd: "rgba(15,118,110,.18)", fg: "var(--accent)", label: "Жылыжай қалыпты" },
  none: { bg: "var(--accent-tint)", bd: "rgba(15,118,110,.18)", fg: "var(--accent)", label: "Алғашқы шолу қажет" },
};

export default function Dashboard() {
  const navigate = useNavigate();
  const userInitials = useAuthStore((s) => s.user?.initials || "АС");
  const [greenhouse, setGreenhouse] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [report, setReport] = useState(null);
  const [plan, setPlan] = useState(null);

  useEffect(() => {
    (async () => {
      const greenhouses = await api.get("/api/greenhouses/");
      const gh = (greenhouses.results || greenhouses)[0];
      setGreenhouse(gh);
      if (!gh) return;

      const allSessions = await api.get("/api/scan-sessions/");
      const mine = (allSessions.results || allSessions)
        .filter((s) => s.greenhouse === gh.id)
        .sort((a, b) => new Date(b.started_at) - new Date(a.started_at));
      setSessions(mine);

      const latestDone = mine.find((s) => s.status === "done");
      if (latestDone) {
        const rep = await api.get(`/api/scan-sessions/${latestDone.id}/report/`);
        setReport(rep);
        const plans = await api.get("/api/plans/");
        const matching = (plans.results || plans).find((p) => p.scan_session === latestDone.id);
        setPlan(matching || null);
      }
    })();
  }, []);

  if (!greenhouse) {
    return (
      <AppShell tabs={<BottomTabBar />}>
        <div className="screen-pad-tight" style={{ paddingTop: 40 }}>Жүктелуде…</div>
      </AppShell>
    );
  }

  const counts = report?.counts || { ok: 0, warn: 0, bad: 0 };
  const statusKey = !report ? "none" : counts.bad ? "bad" : counts.warn ? "warn" : "ok";
  const status = STATUS_STYLE[statusKey];

  return (
    <AppShell tabs={<BottomTabBar />}>
      <div className="screen-pad-tight">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <div className="subtle">{greenhouse.name}</div>
            <div className="title-lg" style={{ marginTop: 2 }}>
              {greenhouse.crop?.name || "Дақыл таңдалмаған"} · {greenhouse.sectors.length} сектор
            </div>
          </div>
          <div className="avatar-circle" style={{ width: 38, height: 38 }}>
            {userInitials}
          </div>
        </div>

        <div className="card card-lg" style={{ background: status.bg, borderColor: status.bd, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ font: "700 15px var(--font)", color: status.fg }}>{status.label}</div>
            <div style={{ font: "500 12px var(--font)", color: "var(--ink-mute)" }}>
              {report ? "Соңғы шолу нәтижесі" : "Шолу әлі болмады"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 18 }}>
            <StatCount value={counts.ok} label="қалыпты" color="var(--accent)" />
            <StatCount value={counts.warn} label="қауіп бар" color="var(--warn)" />
            <StatCount value={counts.bad} label="ауру" color="var(--bad)" />
          </div>
          <PrimaryButton onClick={() => navigate("/app/scan")}>Жылыжайды шолуды бастау</PrimaryButton>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <div style={{ font: "700 14px var(--font)" }}>Емдеу жоспары</div>
            {plan && (
              <div style={{ font: "500 12px var(--font)", color: "var(--ink-mute)" }}>
                {plan.total_count} істің {plan.done_count}-і
              </div>
            )}
          </div>
          {plan ? (
            <div className="card card-lg" style={{ padding: "6px 14px" }}>
              {plan.items.slice(0, 3).map((item) => (
                <div key={item.id} style={{ display: "flex", gap: 12, alignItems: "center", padding: "11px 0", borderBottom: "1px solid rgba(20,32,30,.06)" }}>
                  <div
                    style={{
                      width: 22, height: 22, flex: "none", borderRadius: 7, border: `1.5px solid ${item.done ? "var(--accent)" : "rgba(20,32,30,.22)"}`,
                      background: item.done ? "var(--accent)" : "transparent", color: "#fff", font: "700 12px var(--font)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    {item.done ? "✓" : ""}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ font: "600 13.5px var(--font)", textDecoration: item.done ? "line-through" : "none" }}>{item.title}</div>
                    <div style={{ font: "400 11.5px var(--font)", color: "var(--ink-faint)", marginTop: 2 }}>
                      {item.when_label} · {item.where_label}
                    </div>
                  </div>
                </div>
              ))}
              <button
                onClick={() => navigate(`/app/plan/${plan.scan_session}`)}
                style={{ width: "100%", padding: "12px 0", border: 0, background: "transparent", font: "600 13px var(--font)", color: "var(--accent)", textAlign: "left" }}
              >
                Толық жоспар →
              </button>
            </div>
          ) : (
            <div className="card card-lg" style={{ border: "1px dashed rgba(20,32,30,.18)", color: "var(--ink-faint)", font: "400 13px/1.5 var(--font)" }}>
              Жоспар алғашқы шолудан кейін, ауру табылса пайда болады.
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ font: "700 14px var(--font)" }}>Бұрынғы шолулар</div>
          {sessions.filter((s) => s.status === "done").map((s) => (
            <button
              key={s.id}
              className="card"
              style={{ textAlign: "left", display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}
              onClick={() => navigate(`/app/report/${s.id}`)}
            >
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)" }} />
              <div style={{ flex: 1 }}>
                <div style={{ font: "600 13.5px var(--font)" }}>{new Date(s.started_at).toLocaleDateString("kk-KZ")}</div>
                <div style={{ font: "400 11.5px var(--font)", color: "var(--ink-faint)", marginTop: 2 }}>
                  {s.captures.length} сектор түсірілді
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

function StatCount({ value, label, color }) {
  return (
    <div>
      <div style={{ font: "800 22px var(--font)", color }}>{value}</div>
      <div style={{ font: "500 11px var(--font)", color: "var(--ink-mute)" }}>{label}</div>
    </div>
  );
}
