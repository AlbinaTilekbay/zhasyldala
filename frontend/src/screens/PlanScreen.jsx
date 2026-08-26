import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import AppShell from "../components/AppShell";
import BottomTabBar from "../components/BottomTabBar";
import { TopBar } from "../components/TopBar";

export default function PlanScreen() {
  const { sessionId } = useParams();
  const [plan, setPlan] = useState(null);

  useEffect(() => {
    api.post("/api/plans/generate/", { scan_session: Number(sessionId) }).then(setPlan);
  }, [sessionId]);

  async function toggle(item) {
    const updated = await api.patch(`/api/plan-items/${item.id}/`, { done: !item.done });
    setPlan((prev) => ({ ...prev, items: prev.items.map((it) => (it.id === item.id ? updated : it)) }));
  }

  if (!plan) return <AppShell tabs={<BottomTabBar />}><div className="screen-pad-tight">Жүктелуде…</div></AppShell>;

  const doneCount = plan.items.filter((i) => i.done).length;
  const pct = plan.items.length ? Math.round((doneCount / plan.items.length) * 100) : 0;
  const affected = [...new Set(plan.items.flatMap((i) => i.sector_labels))];

  return (
    <AppShell tabs={<BottomTabBar />}>
      <div className="screen-pad-tight">
        <TopBar
          to="/app"
          title="Емдеу жоспары"
          subtitle={`${plan.week_no}-апта · ${affected.length ? affected.join(", ") : "—"} секторлары`}
        />

        <div className="card card-lg" style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          <div style={{ display: "flex", justifyContent: "space-between", font: "600 12.5px var(--font)" }}>
            <span>Орындалды</span>
            <span style={{ color: "var(--accent)" }}>{doneCount} / {plan.items.length}</span>
          </div>
          <div className="progressbar-track">
            <div className="progressbar-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="subtle">Атқарылған істі белгілеп қойыңыз — келесі шолу емнің әсерін көрсетеді.</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {plan.items.map((item) => (
            <div
              key={item.id}
              className="card"
              style={{ display: "flex", gap: 12, alignItems: "flex-start", cursor: "pointer" }}
              onClick={() => toggle(item)}
            >
              <div
                style={{
                  width: 24, height: 24, flex: "none", borderRadius: 8, border: `1.5px solid ${item.done ? "var(--accent)" : "rgba(20,32,30,.22)"}`,
                  background: item.done ? "var(--accent)" : "transparent", color: "#fff", font: "700 13px var(--font)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                {item.done ? "✓" : ""}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ font: "600 14px var(--font)", textDecoration: item.done ? "line-through" : "none", color: item.done ? "var(--ink-faint)" : "var(--ink)" }}>
                  {item.title}
                </div>
                <div style={{ font: "400 12px/1.5 var(--font)", color: "var(--ink-mute)", marginTop: 3 }}>{item.description}</div>
                <div style={{ display: "flex", gap: 7, marginTop: 8 }}>
                  <span style={{ padding: "4px 8px", borderRadius: 7, background: "#F1F4F2", font: "600 10.5px var(--font)", color: "var(--ink-soft)" }}>{item.when_label}</span>
                  <span style={{ padding: "4px 8px", borderRadius: 7, background: "#F1F4F2", font: "600 10.5px var(--font)", color: "var(--ink-soft)" }}>{item.where_label}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: "var(--accent-tint)", borderRadius: 16, padding: 14, font: "400 12.5px/1.6 var(--font)", color: "#2E4B46" }}>
          Келесі шолу — 7 күннен кейін. Еске салып, ауру шыққан секторларды «дейін/кейін» салыстырамыз.
        </div>
      </div>
    </AppShell>
  );
}
