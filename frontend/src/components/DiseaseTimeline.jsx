import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client";
import { GreenhouseMap, formatKkDate } from "./ui";

// "Аурудың таралуы": the greenhouse map replayed walkthrough by
// walkthrough, so the farmer (or a jury) can watch where a disease
// started and how it moved — or how treatment pushed it back. Sectors
// that turned sick in the current week get a red ring.
export default function DiseaseTimeline({ greenhouseId }) {
  const [data, setData] = useState(null);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    api.get(`/api/scan-sessions/history/?greenhouse=${greenhouseId}`)
      .then((d) => {
        setData(d);
        setFrame(Math.max(0, d.sessions.length - 1));
      })
      .catch(() => setData({ sectors: [], sessions: [] }));
  }, [greenhouseId]);

  useEffect(() => {
    if (!playing || !data) return undefined;
    timer.current = setInterval(() => {
      setFrame((f) => {
        if (f >= data.sessions.length - 1) {
          setPlaying(false);
          return f;
        }
        return f + 1;
      });
    }, 1100);
    return () => clearInterval(timer.current);
  }, [playing, data]);

  const rows = useMemo(() => {
    if (!data?.sessions.length) return [];
    const now = data.sessions[frame].tags;
    const before = frame > 0 ? data.sessions[frame - 1].tags : {};
    const out = [];
    let current = null;
    for (const s of data.sectors) {
      if (s.row !== current) {
        out.push([]);
        current = s.row;
      }
      const tag = now[s.id] || "unscanned";
      const wasBad = before[s.id] === "bad" || before[s.id] === "warn";
      out[out.length - 1].push({ key: s.id, label: s.label, tag, highlight: frame > 0 && (tag === "bad" || tag === "warn") && !wasBad });
    }
    return out;
  }, [data, frame]);

  if (!data || data.sessions.length < 2) return null;

  const tags = Object.values(data.sessions[frame].tags);
  const bad = tags.filter((t) => t === "bad").length;
  const warn = tags.filter((t) => t === "warn").length;

  function play() {
    if (frame >= data.sessions.length - 1) setFrame(0);
    setPlaying(true);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          className="icon-btn"
          onClick={() => (playing ? setPlaying(false) : play())}
          aria-label={playing ? "Тоқтату" : "Ойнату"}
          style={{ background: "var(--ink)", color: "#fff", borderColor: "var(--ink)" }}
        >
          {playing ? (
            <svg viewBox="0 0 20 20" fill="currentColor"><rect x="5" y="4" width="3.5" height="12" rx="1" /><rect x="11.5" y="4" width="3.5" height="12" rx="1" /></svg>
          ) : (
            <svg viewBox="0 0 20 20" fill="currentColor"><path d="M6 4.2v11.6a.8.8 0 0 0 1.2.7l9.3-5.8a.8.8 0 0 0 0-1.4L7.2 3.5A.8.8 0 0 0 6 4.2Z" /></svg>
          )}
        </button>
        <div style={{ flex: 1 }}>
          <div className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{formatKkDate(data.sessions[frame].started_at)}</div>
          <div style={{ font: "400 12px var(--font)", color: "var(--ink-mute)" }}>
            {bad || warn ? `${bad} ауру · ${warn} қауіп` : "ауру жоқ"}
          </div>
        </div>
      </div>
      <GreenhouseMap rows={rows} compact entrance={false} />
      <div>
        <input
          type="range"
          className="timeline-range"
          min={0}
          max={data.sessions.length - 1}
          value={frame}
          onChange={(e) => { setPlaying(false); setFrame(Number(e.target.value)); }}
          aria-label="Апта"
        />
        <div className="timeline-weeks">
          {data.sessions.map((s, i) => <span key={s.session_id} className={i === frame ? "on" : ""}>{i + 1}-апта</span>)}
        </div>
      </div>
    </div>
  );
}
