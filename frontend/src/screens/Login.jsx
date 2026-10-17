import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import AppShell from "../components/AppShell";
import { TopBar } from "../components/TopBar";
import { PrimaryButton } from "../components/ui";
import { useAuthStore } from "../store/useAuthStore";

export default function Login() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const tokens = await api.publicPost("/api/auth/login/", { phone, password });
      // Set the tokens first so the /me/ call below (which goes through
      // the shared api client, respecting VITE_API_BASE_URL) is
      // authenticated with them — a raw fetch() here would bypass that
      // base URL and break on any deploy where the frontend and API
      // aren't same-origin.
      setAuth({ access: tokens.access, refresh: tokens.refresh });
      const user = await api.get("/api/auth/me/");
      setAuth({ user });
      navigate(user.is_staff ? "/admin" : "/app");
    } catch {
      setError("Телефон немесе құпиясөз қате.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <form className="screen-pad" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <TopBar to="/welcome" />
        <div>
          <h1 className="title-lg" style={{ margin: 0 }}>Қайта қош келдіңіз</h1>
          <p className="subtle" style={{ marginTop: 8 }}>Тіркелген телефон нөміріңіз бен құпиясөзді енгізіңіз.</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label className="field">
            <div className="field-label">Телефон</div>
            <input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 701 123 45 67" />
          </label>
          <label className="field">
            <div className="field-label">Құпиясөз</div>
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </label>
        </div>
        {error && <div className="form-error">{error}</div>}
        <PrimaryButton type="submit" disabled={busy || !phone || !password}>{busy ? "Кіруде…" : "Кіру"}</PrimaryButton>
        <button type="button" className="btn-link" style={{ alignSelf: "center" }} onClick={() => navigate("/role")}>
          Аккаунтым жоқ — тіркелу
        </button>
      </form>
    </AppShell>
  );
}
