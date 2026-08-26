import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import AppShell from "../../components/AppShell";
import { TopBar } from "../../components/TopBar";
import { PrimaryButton } from "../../components/ui";
import { useAuthStore } from "../../store/useAuthStore";
import { useSetupStore } from "../../store/useSetupStore";

const FIELDS = [
  { key: "full_name", label: "Аты-жөні", placeholder: "Азамат Серікұлы" },
  { key: "phone", label: "Телефон", placeholder: "+7 701 123 45 67", type: "tel" },
  { key: "greenhouse_name", label: "Жылыжай атауы", placeholder: "№1 жылыжай, Қаскелең" },
  { key: "password", label: "Құпиясөз", placeholder: "••••••••", type: "password" },
];

export default function Register() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const setGreenhouseId = useSetupStore((s) => s.setGreenhouseId);
  const [form, setForm] = useState({ full_name: "", phone: "", greenhouse_name: "", password: "" });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const data = await api.publicPost("/api/auth/register/", form);
      setAuth({ access: data.access, refresh: data.refresh, user: data.user });
      setGreenhouseId(data.greenhouse_id);
      navigate("/setup/crop");
    } catch (err) {
      setError(err.data?.phone?.[0] || err.data?.password?.[0] || err.message || "Тіркеу сәтсіз аяқталды");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="screen-pad">
        <TopBar to="/role" subtitle="1-қадам / 3" title="" />
        <div className="title-lg">Шаруашылықты тіркеу</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {FIELDS.map((f) => (
            <label className="field" key={f.key}>
              <div className="field-label">{f.label}</div>
              <input
                type={f.type || "text"}
                placeholder={f.placeholder}
                value={form[f.key]}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              />
            </label>
          ))}
        </div>
        {error && <div style={{ color: "var(--bad)", font: "500 13px var(--font)" }}>{error}</div>}
        <PrimaryButton onClick={submit} disabled={busy}>
          {busy ? "Жіберілуде…" : "Әрі қарай — дақыл"}
        </PrimaryButton>
      </div>
    </AppShell>
  );
}
