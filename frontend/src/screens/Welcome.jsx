import { useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import { GreenhouseHero } from "../components/Illustrations";
import { PrimaryButton } from "../components/ui";

const FEATURES = [
  ["Әр қатарға QR белгі", "басып шығарып, жылыжайға іліп қоясыз"],
  ["Телефонмен шолу", "әр секторды 3–10 фотоға түсіресіз"],
  ["Диагноз және жоспар", "ауру қай жерде екенін және не істеу керегін көрсетеді"],
];

export default function Welcome() {
  const navigate = useNavigate();
  return (
    <AppShell>
      {/* Exactly one visible screen tall (dvh = the area Safari's toolbars
          leave), with the illustration as the only part that shrinks — so
          "Бастау" is always on screen without scrolling, down to iPhone SE. */}
      <div className="welcome">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ font: "600 15px var(--font-display)", letterSpacing: "-0.01em" }}>
            Zhasyl<span style={{ color: "var(--accent)" }}>Dala</span>
          </span>
          <span className="eyebrow">жылыжай дәрігері</span>
        </div>

        <div className="welcome-hero">
          <GreenhouseHero />
        </div>

        <div className="rise" style={{ animationDelay: ".25s" }}>
          <h1 className="title-xl welcome-title" style={{ margin: 0 }}>
            Ауруды көзге көрінбей тұрып <em style={{ color: "var(--accent)", fontStyle: "italic" }}>табыңыз.</em>
          </h1>
          <p className="subtle welcome-lead">
            Жылыжайды секторларға бөліп, телефонмен аралап шығыңыз — ZhasylDala қай түпте не болып жатқанын
            айтып, емдеу жоспарын құрады.
          </p>
        </div>

        <div className="ledger rise" style={{ animationDelay: ".4s" }}>
          {FEATURES.map(([title, sub], i) => (
            <div className="ledger-row" key={title} style={{ alignItems: "baseline", padding: "9px 0" }}>
              <span className="sec-no" style={{ width: 22 }}>{String(i + 1).padStart(2, "0")}</span>
              <div>
                <div style={{ font: "600 14px var(--font)" }}>{title}</div>
                <div className="welcome-sub">{sub}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="welcome-cta">
          <PrimaryButton onClick={() => navigate("/role")}>Бастау</PrimaryButton>
          <button className="btn-link" onClick={() => navigate("/login")}>Тіркелгенім бар — кіру</button>
        </div>
      </div>
    </AppShell>
  );
}
