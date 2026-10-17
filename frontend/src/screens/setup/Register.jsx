import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import AppShell from "../../components/AppShell";
import { TopBar } from "../../components/TopBar";
import { PrimaryButton, StepBar } from "../../components/ui";
import { useAuthStore } from "../../store/useAuthStore";
import { useSetupStore } from "../../store/useSetupStore";

const FIELDS = [
  { key: "full_name", label: "Аты-жөні", placeholder: "Азамат Серікұлы", autoComplete: "name" },
  { key: "phone", label: "Телефон", placeholder: "+7 701 123 45 67", type: "tel", autoComplete: "tel" },
  { key: "greenhouse_name", label: "Жылыжай атауы", placeholder: "№1 жылыжай, Қаскелең" },
  { key: "password", label: "Құпиясөз", placeholder: "кемінде 6 таңба", type: "password", autoComplete: "new-password" },
];

// Django's password validators and unique-field errors come back in
// English regardless of LANGUAGE_CODE; translate the ones a farmer can
// actually hit so the form never shows English mid-flow.
const ERROR_KK = [
  [/too short/i, "Құпиясөз тым қысқа — кемінде 6 таңба болсын."],
  [/too common/i, "Бұл құпиясөз тым қарапайым — басқасын ойлап табыңыз."],
  [/entirely numeric/i, "Құпиясөз тек сандардан тұрмасын — әріп қосыңыз."],
  [/too similar/i, "Құпиясөз аты-жөніңізге тым ұқсас."],
  [/already exists|тіркелген/i, "Бұл телефон нөмірі бұрын тіркелген — «Кіру» арқылы кіріңіз."],
];

function kkError(err) {
  const raw = err?.data?.phone?.[0] || err?.data?.password?.[0] || err?.data?.full_name?.[0] || err?.message || "";
  const hit = ERROR_KK.find(([re]) => re.test(raw));
  return hit ? hit[1] : raw || "Тіркеу сәтсіз аяқталды. Қайталап көріңіз.";
}

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
      setError(kkError(err));
    } finally {
      setBusy(false);
    }
  }

  const filled = Object.values(form).every((v) => v.trim());

  return (
    <AppShell>
      <form className="screen-pad" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <TopBar to="/role" />
        <StepBar step={1} />
        <div>
          <h1 className="title-lg" style={{ margin: 0 }}>Шаруашылықты тіркеу</h1>
          <p className="subtle" style={{ marginTop: 8 }}>Үш қадам: сіз туралы, дақыл, жылыжай торы. Шамамен 2 минут.</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {FIELDS.map((f) => (
            <label className="field" key={f.key}>
              <div className="field-label">{f.label}</div>
              <input
                type={f.type || "text"}
                inputMode={f.type === "tel" ? "tel" : undefined}
                autoComplete={f.autoComplete}
                placeholder={f.placeholder}
                value={form[f.key]}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              />
            </label>
          ))}
        </div>
        {error && <div className="form-error">{error}</div>}
        <PrimaryButton type="submit" disabled={busy || !filled}>
          {busy ? "Жіберілуде…" : "Әрі қарай — дақыл"}
        </PrimaryButton>
      </form>
    </AppShell>
  );
}
