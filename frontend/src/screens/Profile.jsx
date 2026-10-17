import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import AppShell from "../components/AppShell";
import BottomTabBar from "../components/BottomTabBar";
import { ArrowIcon, SectionHead } from "../components/ui";
import { useAuthStore } from "../store/useAuthStore";

export default function Profile() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [greenhouse, setGreenhouse] = useState(null);
  const [scanCount, setScanCount] = useState(null);

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
    if (!window.confirm("Аккаунттан шығасыз ба?")) return;
    logout();
    navigate("/welcome");
  }

  const rows = [
    { label: "Дақыл", value: greenhouse?.crop?.name || "—" },
    { label: "Секторлар", value: greenhouse ? `${greenhouse.preset_label} · ${greenhouse.sectors.length}` : "—" },
    { label: "QR белгілер", value: "Басып шығару", to: "/setup/qr" },
    { label: "Шолу еске салғышы", value: `${user?.scan_reminder_days || 7} күнде бір` },
    { label: "Тіл", value: "Қазақша" },
  ];

  return (
    <AppShell tabs={<BottomTabBar />}>
      <div className="screen-pad-tight">
        <div style={{ display: "flex", alignItems: "center", gap: 14, paddingTop: 6 }}>
          <div className="avatar-circle" style={{ width: 56, height: 56, fontSize: 21 }}>{user?.initials}</div>
          <div style={{ minWidth: 0 }}>
            <div className="title-serif" style={{ fontSize: 21 }}>{user?.full_name}</div>
            <div className="mono" style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 3 }}>{user?.phone}</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", border: "1px solid var(--ink-hairline)", borderRadius: "var(--radius-md)", background: "var(--bg-card)" }}>
          <ProfileStat value={greenhouse?.sectors.length ?? "—"} label="сектор" />
          <ProfileStat value={scanCount ?? "—"} label="шолу жасалды" divider />
        </div>

        <SectionHead no={1} title={greenhouse?.name || "Жылыжай"} />
        <div className="ledger">
          {rows.map((row) => {
            const Tag = row.to ? "button" : "div";
            return (
              <Tag key={row.label} className="ledger-row" onClick={row.to ? () => navigate(row.to) : undefined} style={{ cursor: row.to ? "pointer" : "default" }}>
                <span style={{ flex: 1, font: "500 14px var(--font)" }}>{row.label}</span>
                <span style={{ font: "500 13px var(--font)", color: row.to ? "var(--accent)" : "var(--ink-mute)" }}>{row.value}</span>
                {row.to && <ArrowIcon className="ledger-go" />}
              </Tag>
            );
          })}
        </div>

        <button className="btn btn-danger-ghost" style={{ marginTop: 8 }} onClick={handleLogout}>Шығу</button>
      </div>
    </AppShell>
  );
}

function ProfileStat({ value, label, divider }) {
  return (
    <div style={{ padding: "14px 16px", borderLeft: divider ? "1px solid var(--ink-hairline)" : 0 }}>
      <div style={{ font: "600 26px/1 var(--mono)", color: "var(--accent)" }}>{value}</div>
      <div style={{ font: "400 12px var(--font)", color: "var(--ink-mute)", marginTop: 6 }}>{label}</div>
    </div>
  );
}
