import { useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import { PrimaryButton } from "../components/ui";

const FEATURES = [
  "Әр секторға QR белгі",
  "Сектор сайын қадағалау",
  "Есеп және апталық емдеу жоспары",
];

export default function Welcome() {
  const navigate = useNavigate();
  return (
    <AppShell>
      <div
        style={{
          height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between",
          padding: "34px 26px", background: "linear-gradient(180deg,#E6F2F0 0%,#F6F7F6 62%)", minHeight: "100dvh",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div
            style={{
              width: 52, height: 52, borderRadius: 16, background: "var(--accent)", display: "flex",
              alignItems: "center", justifyContent: "center", font: "800 22px var(--font)", color: "#fff",
            }}
          >
            Z
          </div>
          <div>
            <div className="title-xl">ZhasylDala</div>
            <p style={{ margin: "12px 0 0", font: "400 15px/1.55 var(--font)", color: "#5C6B67", maxWidth: 290 }}>
              Жылыжайды секторға бөліп түсіріп шығыңыз — қолданба ауруды көзге көрінбей тұрып тауып,
              емдеу жоспарын береді.
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
            {FEATURES.map((f) => (
              <div key={f} style={{ display: "flex", gap: 10, alignItems: "center", font: "500 13.5px var(--font)", color: "#3D4B47" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)" }} />
                {f}
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <PrimaryButton onClick={() => navigate("/role")}>Бастау</PrimaryButton>
          <button
            onClick={() => navigate("/login")}
            style={{ background: "transparent", border: 0, font: "500 13px var(--font)", color: "var(--accent)" }}
          >
            Тіркелгенім бар — кіру
          </button>
        </div>
      </div>
    </AppShell>
  );
}
