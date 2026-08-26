import { useEffect, useState } from "react";
import { api } from "../api/client";
import AppShell from "../components/AppShell";
import BottomTabBar from "../components/BottomTabBar";
import { Chip } from "../components/ui";

export default function Tips() {
  const [crops, setCrops] = useState([]);
  const [cropId, setCropId] = useState(null);
  const [tips, setTips] = useState([]);

  useEffect(() => {
    api.publicGet("/api/crops/").then((data) => {
      const list = data.results || data;
      setCrops(list);
      if (list.length) setCropId(list[0].id);
    });
  }, []);

  useEffect(() => {
    if (!cropId) return;
    api.publicGet(`/api/tips/?crop=${cropId}`).then((data) => setTips(data.results || data));
  }, [cropId]);

  return (
    <AppShell tabs={<BottomTabBar />}>
      <div className="screen-pad-tight">
        <div>
          <div className="title-lg">Кеңестер</div>
          <div className="subtle" style={{ marginTop: 3 }}>Дақылыңыз мен мезгілге қарай</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {crops.map((c) => (
            <Chip key={c.id} active={c.id === cropId} onClick={() => setCropId(c.id)}>{c.name}</Chip>
          ))}
        </div>
        {tips.length === 0 && (
          <div className="card card-lg" style={{ color: "var(--ink-faint)", font: "400 13px/1.5 var(--font)" }}>
            Бұл дақыл үшін кеңестер әлі қосылмады.
          </div>
        )}
        {tips.map((t) => (
          <div key={t.id} className="card card-lg" style={{ padding: 0, overflow: "hidden" }}>
            <div className="placeholder-photo" style={{ height: 96 }}>{t.image_caption}</div>
            <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 7 }}>
              <div style={{ font: "600 11px var(--font)", color: "var(--accent)", letterSpacing: ".05em", textTransform: "uppercase" }}>{t.tag}</div>
              <div style={{ font: "700 15.5px/1.3 var(--font)" }}>{t.title}</div>
              <div className="subtle">{t.body}</div>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
