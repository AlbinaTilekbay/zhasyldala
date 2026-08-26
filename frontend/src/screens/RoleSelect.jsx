import { useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";

export default function RoleSelect() {
  const navigate = useNavigate();
  return (
    <AppShell>
      <div className="screen-pad">
        <div>
          <div className="title-lg">Сіз кімсіз?</div>
          <p className="subtle" style={{ marginTop: 8 }}>Мұны кейін профильде өзгертуге болады.</p>
        </div>

        <button
          className="card card-lg"
          style={{ textAlign: "left", display: "flex", flexDirection: "column", gap: 8, cursor: "pointer" }}
          onClick={() => navigate("/home")}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 38, height: 38, borderRadius: 12, background: "var(--accent-tint)", display: "flex",
                alignItems: "center", justifyContent: "center", font: "700 15px var(--font)", color: "var(--accent)",
              }}
            >
              Ү
            </div>
            <div style={{ font: "700 17px var(--font)" }}>Үй өсімдігі</div>
          </div>
          <div className="subtle">Бір сурет — диагноз және күтім кеңесі. Тіркелудің қажеті жоқ.</div>
          <div style={{ font: "600 12px var(--font)", color: "var(--accent)" }}>Бірден камераға →</div>
        </button>

        <button
          className="card card-lg"
          style={{ textAlign: "left", display: "flex", flexDirection: "column", gap: 8, cursor: "pointer" }}
          onClick={() => navigate("/register")}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 38, height: 38, borderRadius: 12, background: "var(--ink)", display: "flex",
                alignItems: "center", justifyContent: "center", font: "700 15px var(--font)", color: "#fff",
              }}
            >
              Ж
            </div>
            <div style={{ font: "700 17px var(--font)" }}>Жылыжай / фермер</div>
          </div>
          <div className="subtle">Секторлар, QR белгілер, тұрақты шолу, есептер мен емдеу жоспары.</div>
          <div style={{ font: "600 12px var(--font)", color: "var(--accent)" }}>Тіркелу қажет →</div>
        </button>
      </div>
    </AppShell>
  );
}
