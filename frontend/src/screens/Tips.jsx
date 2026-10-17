import { useEffect, useState } from "react";
import { api } from "../api/client";
import AppShell from "../components/AppShell";
import BottomTabBar from "../components/BottomTabBar";
import { TipArt } from "../components/Illustrations";
import { Chip, Spinner } from "../components/ui";
import { useAuthStore } from "../store/useAuthStore";

export default function Tips() {
  const isAuthed = useAuthStore((s) => Boolean(s.accessToken));
  const [crops, setCrops] = useState([]);
  const [cropId, setCropId] = useState(null);
  const [tips, setTips] = useState(null);

  useEffect(() => {
    (async () => {
      const data = await api.publicGet("/api/crops/");
      const list = data.results || data;
      setCrops(list);
      // Open on the farmer's own crop rather than always the first one.
      let initial = list[0]?.id ?? null;
      if (isAuthed) {
        try {
          const greenhouses = await api.get("/api/greenhouses/");
          const mine = (greenhouses.results || greenhouses)[0]?.crop?.id;
          if (mine) initial = mine;
        } catch {
          // fall back to the first crop
        }
      }
      setCropId(initial);
    })();
  }, [isAuthed]);

  useEffect(() => {
    if (!cropId) return;
    setTips(null);
    api.publicGet(`/api/tips/?crop=${cropId}`).then((data) => setTips(data.results || data)).catch(() => setTips([]));
  }, [cropId]);

  return (
    <AppShell tabs={<BottomTabBar />}>
      <div className="screen-pad-tight">
        <div>
          <div className="eyebrow">Агроном кеңестері</div>
          <h1 className="title-lg" style={{ margin: "4px 0 0" }}>Кеңестер</h1>
        </div>
        <div className="chip-scroll">
          {crops.map((c) => (
            <Chip key={c.id} active={c.id === cropId} onClick={() => setCropId(c.id)}>{c.name}</Chip>
          ))}
        </div>
        {tips === null && <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Spinner /></div>}
        {tips?.length === 0 && <div className="empty-slot">Бұл дақыл үшін кеңестер әлі қосылмады.</div>}
        {tips?.map((t, i) => (
          <article key={t.id} className="card rise" style={{ padding: 0, overflow: "hidden", animationDelay: `${i * 0.06}s` }}>
            <div style={{ height: 112, background: "var(--accent-tint)", padding: "12px 16px", borderBottom: "1px solid var(--ink-hairline)" }}>
              <TipArt tag={t.tag} />
            </div>
            <div style={{ padding: "14px 16px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span className="eyebrow" style={{ color: "var(--accent)" }}>{t.tag}</span>
                <span className="eyebrow">{String(i + 1).padStart(2, "0")}</span>
              </div>
              <div className="title-serif" style={{ fontSize: 19, lineHeight: 1.25 }}>{t.title}</div>
              <p className="subtle" style={{ fontSize: 14 }}>{t.body}</p>
            </div>
          </article>
        ))}
      </div>
    </AppShell>
  );
}
