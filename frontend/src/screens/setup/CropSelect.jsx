import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import AppShell from "../../components/AppShell";
import { TopBar } from "../../components/TopBar";
import { PrimaryButton, StepBar } from "../../components/ui";
import { useSetupStore } from "../../store/useSetupStore";

export default function CropSelect() {
  const navigate = useNavigate();
  const greenhouseId = useSetupStore((s) => s.greenhouseId);
  const cropId = useSetupStore((s) => s.cropId);
  const setCropId = useSetupStore((s) => s.setCropId);
  const [crops, setCrops] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.publicGet("/api/crops/").then((data) => setCrops(data.results || data));
  }, []);

  useEffect(() => {
    // useSetupStore isn't persisted (by design — a fresh wizard should
    // start clean), so a reloaded tab loses greenhouseId. Without this
    // guard the request below would silently 404 against
    // "/api/greenhouses/null/" and the button would look dead (tap
    // color flashes, nothing after) with no way to tell why.
    if (!greenhouseId) navigate("/register", { replace: true });
  }, [greenhouseId, navigate]);

  async function next() {
    if (!cropId) return;
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/api/greenhouses/${greenhouseId}/`, { crop_id: cropId });
      navigate("/setup/grid");
    } catch (err) {
      setError(err?.data?.detail || err?.message || "Сақталмады. Қайталап көріңіз.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="screen-pad">
        <TopBar to="/register" />
        <StepBar step={2} />
        <div>
          <h1 className="title-lg" style={{ margin: 0 }}>Не өсіресіз?</h1>
          <p className="subtle" style={{ marginTop: 8 }}>
            Дақылға қарай жүйе іздейтін аурулар мен «Кеңестер» бөлімі бапталады.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {crops.map((c, i) => {
            const active = c.id === cropId;
            return (
              <button
                key={c.id}
                onClick={() => setCropId(c.id)}
                className="rise"
                style={{
                  textAlign: "left", padding: "14px 14px 12px", borderRadius: "var(--radius-md)", cursor: "pointer",
                  border: `1px solid ${active ? "var(--ink)" : "var(--ink-hairline)"}`, background: active ? "var(--ink)" : "var(--bg-card)",
                  color: active ? "#fff" : "var(--ink)", display: "flex", flexDirection: "column", gap: 14, transition: "background .15s, color .15s",
                  animationDelay: `${i * 0.04}s`,
                }}
              >
                <span className="mono" style={{ fontSize: 10.5, opacity: 0.6 }}>{String(i + 1).padStart(2, "0")}</span>
                <span className="title-serif" style={{ fontSize: 18 }}>{c.name}</span>
              </button>
            );
          })}
        </div>
        {error && <div className="form-error">{error}</div>}
        <PrimaryButton onClick={next} disabled={!cropId || busy}>
          {busy ? "Сақталуда…" : "Әрі қарай — секторлар"}
        </PrimaryButton>
      </div>
    </AppShell>
  );
}
