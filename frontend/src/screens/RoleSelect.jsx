import { useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import { GreenhouseSmall, PottedPlant } from "../components/Illustrations";
import { TopBar } from "../components/TopBar";
import { ArrowIcon } from "../components/ui";

const ROLES = [
  {
    to: "/home", Art: PottedPlant, eyebrow: "01 · тіркеусіз", title: "Үй өсімдігі",
    body: "Бір фото — диагноз және күтім кеңесі. Бірден камера ашылады.",
  },
  {
    to: "/register", Art: GreenhouseSmall, eyebrow: "02 · фермер", title: "Жылыжай",
    body: "Секторлар, QR белгілер, тұрақты шолу, есеп және апталық емдеу жоспары.",
  },
];

export default function RoleSelect() {
  const navigate = useNavigate();
  return (
    <AppShell>
      <div className="screen-pad">
        <TopBar to="/welcome" />
        <div>
          <h1 className="title-lg" style={{ margin: 0 }}>Нені тексереміз?</h1>
          <p className="subtle" style={{ marginTop: 8 }}>Кейін басқа режимге кез келген уақытта ауыса аласыз.</p>
        </div>

        {ROLES.map(({ to, Art, eyebrow, title, body }, i) => (
          <button
            key={to}
            className="card rise"
            onClick={() => navigate(to)}
            style={{
              textAlign: "left", display: "grid", gridTemplateColumns: "1fr auto", gap: "6px 14px", padding: "18px 18px 16px",
              cursor: "pointer", color: "var(--ink)", animationDelay: `${0.08 + i * 0.08}s`,
            }}
          >
            <div className="eyebrow" style={{ color: "var(--accent)" }}>{eyebrow}</div>
            <div style={{ gridRow: "span 3", color: i ? "var(--ink)" : "var(--accent)", alignSelf: "center" }}>
              <Art size={68} />
            </div>
            <div className="title-serif" style={{ fontSize: 22 }}>{title}</div>
            <div style={{ font: "400 13px/1.5 var(--font)", color: "var(--ink-mute)", maxWidth: 220 }}>{body}</div>
            <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", color: "var(--accent)", borderTop: "1px solid var(--ink-hairline)", paddingTop: 10, marginTop: 6 }}>
              <ArrowIcon className="" />
            </div>
          </button>
        ))}
        <button className="btn-link" style={{ alignSelf: "center", marginTop: 4 }} onClick={() => navigate("/login")}>
          Тіркелгенім бар — кіру
        </button>
      </div>
    </AppShell>
  );
}
