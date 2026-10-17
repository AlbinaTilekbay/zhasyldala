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
      <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", padding: "18px 22px 22px", gap: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ font: "600 15px var(--font-display)", letterSpacing: "-0.01em" }}>
            Zhasyl<span style={{ color: "var(--accent)" }}>Dala</span>
          </span>
          <span className="eyebrow">жылыжай дәрігері</span>
        </div>

        <div style={{ margin: "0 auto", width: "100%", maxWidth: 300 }}>
          <GreenhouseHero />
        </div>

        <div className="rise" style={{ animationDelay: ".25s" }}>
          <h1 className="title-xl" style={{ margin: 0, fontSize: 34 }}>
            Ауруды көзге көрінбей тұрып <em style={{ color: "var(--accent)", fontStyle: "italic" }}>табыңыз.</em>
          </h1>
          <p className="subtle" style={{ marginTop: 12, fontSize: 15, maxWidth: 330 }}>
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
                <div style={{ font: "400 12.5px/1.45 var(--font)", color: "var(--ink-mute)", marginTop: 2 }}>{sub}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
          <PrimaryButton onClick={() => navigate("/role")}>Бастау</PrimaryButton>
          <button className="btn-link" onClick={() => navigate("/login")}>Тіркелгенім бар — кіру</button>
        </div>
      </div>
    </AppShell>
  );
}
