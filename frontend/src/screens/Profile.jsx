import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import AppShell from "../components/AppShell";
import BottomTabBar from "../components/BottomTabBar";
import { useAuthStore } from "../store/useAuthStore";

export default function Profile() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [greenhouse, setGreenhouse] = useState(null);
  const [scanCount, setScanCount] = useState(0);

  useEffect(() => {
    (async () => {
      const greenhouses = await api.get("/api/greenhouses/");
      const gh = (greenhouses.results || greenhouses)[0];
      setGreenhouse(gh);
      const sessions = await api.get("/api/scan-sessions/");
      setScanCount((sessions.results || sessions).filter((s) => s.status === "done").length);
    })();
  }, []);

  function handleLogout() {
    logout();
    navigate("/welcome");
  }

  const rows = greenhouse
    ? [
        { label: "Дақылдар", value: greenhouse.crop?.name || "—" },
        { label: "Секторлар", value: `${greenhouse.rows}×${greenhouse.cols}` },
        { label: "QR белгілер", value: "Қайта басып шығару", to: "/setup/qr" },
        { label: "Шолу еске салғышы", value: `${user?.scan_reminder_days || 7} күнде бір` },
        { label: "Тіл", value: "Қазақша" },
      ]
    : [];

  return (
    <AppShell tabs={<BottomTabBar />}>
      <div className="screen-pad-tight">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div className="avatar-circle" style={{ width: 54, height: 54, fontSize: 19 }}>{user?.initials}</div>
          <div>
            <div style={{ font: "700 18px var(--font)" }}>{user?.full_name}</div>
            <div className="subtle">{user?.phone} · {greenhouse?.name}</div>
          </div>
        </div>

        <div className="card card-lg" style={{ background: "var(--accent-tint)", display: "flex", gap: 16 }}>
          <ProfileStat value={greenhouse?.sectors.length ?? "—"} label="сектор" />
          <ProfileStat value={scanCount} label="шолу" />
        </div>

        <div className="card card-lg" style={{ padding: "4px 14px" }}>
          {rows.map((row) => (
            <div
              key={row.label}
              onClick={() => row.to && navigate(row.to)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0",
                borderBottom: "1px solid rgba(20,32,30,.06)", cursor: row.to ? "pointer" : "default",
              }}
            >
              <div style={{ font: "500 14px var(--font)" }}>{row.label}</div>
              <div style={{ font: "500 13px var(--font)", color: "var(--ink-faint)" }}>{row.value}</div>
            </div>
          ))}
        </div>

        <button className="btn btn-danger-ghost" onClick={handleLogout}>Шығу</button>
      </div>
    </AppShell>
  );
}

function ProfileStat({ value, label }) {
  return (
    <div>
      <div style={{ font: "800 20px var(--font)", color: "var(--accent)" }}>{value}</div>
      <div style={{ font: "500 11px var(--font)", color: "#4E635E" }}>{label}</div>
    </div>
  );
}
