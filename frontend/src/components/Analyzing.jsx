import { useEffect, useState } from "react";

const DEFAULT_STEPS = ["Фото жүктелді", "Жапырақ пен дақтар тексерілуде", "Өсімдік түрі анықталуда", "Кеңестер жазылуда"];

// The wait screen while a photo is being diagnosed: the farmer's own
// photo with a scan line sweeping over it and a checklist that ticks
// forward. The steps are paced, not real progress events — the backend
// gives one answer at the end — so the last step stays "in progress"
// until the caller unmounts this.
export default function Analyzing({ photoUrl, title = "Талдау жүріп жатыр", steps = DEFAULT_STEPS }) {
  const [done, setDone] = useState(1);

  useEffect(() => {
    const t = setInterval(() => setDone((d) => Math.min(d + 1, steps.length - 1)), 1900);
    return () => clearInterval(t);
  }, [steps.length]);

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", justifyContent: "center", gap: 26, padding: "30px 28px", background: "var(--bg-shell)" }}>
      <div style={{ position: "relative", width: "100%", maxWidth: 300, aspectRatio: "4 / 5", margin: "0 auto", borderRadius: 12, overflow: "hidden", background: "#E4EAE7" }}>
        {photoUrl && <img src={photoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", filter: "saturate(.85)" }} />}
        <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(0deg, rgba(15,118,110,.07) 0 1px, transparent 1px 22px), repeating-linear-gradient(90deg, rgba(15,118,110,.07) 0 1px, transparent 1px 22px)" }} />
        <div style={{ position: "absolute", left: 0, right: 0, height: 2, background: "var(--scan-line)", boxShadow: "0 0 18px 4px rgba(47,211,182,.55)", animation: "zd-sweep 1.6s ease-in-out infinite alternate" }} />
        {["0 auto auto 0", "0 0 auto auto", "auto auto 0 0", "auto 0 0 auto"].map((inset, i) => (
          <span key={i} style={{
            position: "absolute", inset, width: 22, height: 22, margin: 10,
            borderTop: i < 2 ? "2px solid #fff" : 0, borderBottom: i >= 2 ? "2px solid #fff" : 0,
            borderLeft: i % 2 === 0 ? "2px solid #fff" : 0, borderRight: i % 2 === 1 ? "2px solid #fff" : 0,
          }} />
        ))}
      </div>
      <div>
        <div className="title-serif" style={{ fontSize: 22, textAlign: "center" }}>{title}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 18, maxWidth: 280, marginLeft: "auto", marginRight: "auto" }}>
          {steps.map((s, i) => {
            const state = i < done ? "done" : i === done ? "now" : "todo";
            return (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: 10, font: "500 13.5px var(--font)", color: state === "todo" ? "var(--ink-faint)" : "var(--ink)", transition: "color .3s" }}>
                <span style={{
                  width: 16, height: 16, borderRadius: 4, flex: "none", display: "flex", alignItems: "center", justifyContent: "center",
                  background: state === "done" ? "var(--accent)" : "transparent", border: state === "done" ? 0 : `1.5px solid ${state === "now" ? "var(--accent)" : "rgba(20,32,30,.2)"}`,
                  animation: state === "now" ? "gg-pulse 1.2s ease-in-out infinite" : undefined,
                }}>
                  {state === "done" && (
                    <svg width="10" height="10" viewBox="0 0 14 14" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 7.2 5.6 10.2 11.5 3.8" /></svg>
                  )}
                </span>
                {s}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
