import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import AppShell from "../components/AppShell";
import BottomTabBar from "../components/BottomTabBar";
import DoseCalculator, { suggestProduct } from "../components/DoseCalculator";
import { TopBar } from "../components/TopBar";
import { CheckBox, SectionHead, Spinner } from "../components/ui";

export default function PlanScreen() {
  const { sessionId } = useParams();
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState(null);
  const [suggested, setSuggested] = useState(null);

  useEffect(() => {
    api.post("/api/plans/generate/", { scan_session: Number(sessionId) }).then(setPlan).catch(() => setError("Жоспар жүктелмеді."));
    // Best-effort: the calculator just keeps its default if the report fails.
    api.get(`/api/scan-sessions/${sessionId}/report/`)
      .then((rep) => setSuggested(suggestProduct(rep.rows.flat().filter((c) => c.tag === "bad" || c.tag === "warn").map((c) => c.diagnosis_disease))))
      .catch(() => {});
  }, [sessionId]);

  async function toggle(item) {
    // Optimistic: the tick animates immediately; rolled back on failure.
    setPlan((prev) => ({ ...prev, items: prev.items.map((it) => (it.id === item.id ? { ...it, done: !item.done } : it)) }));
    try {
      const updated = await api.patch(`/api/plan-items/${item.id}/`, { done: !item.done });
      setPlan((prev) => ({ ...prev, items: prev.items.map((it) => (it.id === item.id ? updated : it)) }));
    } catch {
      setPlan((prev) => ({ ...prev, items: prev.items.map((it) => (it.id === item.id ? item : it)) }));
      setError("Сақталмады — интернетті тексеріңіз.");
    }
  }

  if (!plan) {
    return (
      <AppShell tabs={<BottomTabBar />}>
        <div className="screen-pad-tight">
          <TopBar to="/app" title="Емдеу жоспары" />
          {error ? <div className="form-error">{error}</div> : <div style={{ display: "flex", justifyContent: "center", paddingTop: 80 }}><Spinner /></div>}
        </div>
      </AppShell>
    );
  }

  const doneCount = plan.items.filter((i) => i.done).length;
  const total = plan.items.length;
  const affected = [...new Set(plan.items.flatMap((i) => i.sector_labels))];
  // The dose calculator needs only the sectors that actually get sprayed,
  // not every sector the plan touches — a "watch" sector that's only
  // re-watered (e.g. D6 in week 1) would otherwise inflate the dose.
  // Spray steps are the ones titled "…өңдеу" (both generated and hand-
  // written plans use the word); with none, fall back to all sectors.
  const sprayed = [...new Set(plan.items.filter((i) => /өңдеу/i.test(i.title)).flatMap((i) => i.sector_labels))];
  const doseSectors = sprayed.length ? sprayed : affected;
  const allDone = total > 0 && doneCount === total;

  return (
    <AppShell tabs={<BottomTabBar />}>
      <div className="screen-pad-tight">
        <TopBar to="/app" subtitle={`${plan.week_no}-апта`} title="Емдеу жоспары" />

        <div className="rise">
          <div className="title-lg">
            {allDone ? "Барлығы орындалды" : <>{total - doneCount} іс <span style={{ color: "var(--ink-faint)" }}>қалды</span></>}
          </div>
          <p className="subtle" style={{ marginTop: 6 }}>
            Секторлар: <span className="mono" style={{ color: "var(--ink)", fontWeight: 600 }}>{affected.length ? affected.join(" · ") : "—"}</span>
          </p>
        </div>

        <div style={{ display: "flex", gap: 4 }}>
          {plan.items.map((it) => (
            <span key={it.id} style={{ flex: 1, height: 6, borderRadius: 2, background: it.done ? "var(--accent)" : "#DDE4E1", transition: "background .3s" }} />
          ))}
        </div>

        <SectionHead no={1} title="Істер" aside={`${doneCount}/${total}`} />
        <div className="ledger">
          {plan.items.map((item) => (
            <button
              key={item.id}
              className="ledger-row"
              style={{ alignItems: "flex-start", cursor: "pointer", padding: "15px 0" }}
              onClick={() => toggle(item)}
              aria-pressed={item.done}
            >
              <CheckBox on={item.done} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", font: "600 14.5px/1.35 var(--font)", textDecoration: item.done ? "line-through" : "none", color: item.done ? "var(--ink-faint)" : "var(--ink)", transition: "color .2s" }}>
                  {item.title}
                </span>
                {!item.done && <span style={{ display: "block", font: "400 13px/1.5 var(--font)", color: "var(--ink-mute)", marginTop: 4 }}>{item.description}</span>}
                <span className="mono" style={{ display: "flex", gap: 10, marginTop: 8, fontSize: 11, color: "var(--accent)" }}>
                  <span>{item.when_label}</span>
                  <span style={{ color: "var(--ink-faint)" }}>{item.where_label}</span>
                </span>
              </span>
            </button>
          ))}
        </div>
        {error && <div className="form-error">{error}</div>}

        {affected.length > 0 && (
          <>
            <SectionHead no={2} title="Препарат мөлшері" aside="калькулятор" />
            <DoseCalculator greenhouseId={plan.greenhouse} sectorCount={doseSectors.length} suggested={suggested} />
          </>
        )}

        <div className="note">
          Келесі шолуды 7 күннен кейін жасаңыз — ауру шыққан секторларды «дейін / кейін» салыстырып, емнің әсерін көрсетеміз.
        </div>
      </div>
    </AppShell>
  );
}
