import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import AppShell from "../../components/AppShell";
import { TopBar } from "../../components/TopBar";
import { Chip, PrimaryButton } from "../../components/ui";
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
        <TopBar to="/register" subtitle="2-қадам / 3" title="" />
        <div>
          <div className="title-lg">Не өсіресіз?</div>
          <p className="subtle" style={{ marginTop: 8 }}>
            Дақылға қарай модель іздейтін аурулар мен «Кеңестер» бөліміндегі мазмұн таңдалады.
          </p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {crops.map((c) => (
            <Chip key={c.id} active={c.id === cropId} onClick={() => setCropId(c.id)}>
              {c.name}
            </Chip>
          ))}
        </div>
        {error && <div style={{ color: "var(--bad)", font: "500 13px var(--font)" }}>{error}</div>}
        <PrimaryButton onClick={next} disabled={!cropId || busy}>
          {busy ? "Сақталуда…" : "Әрі қарай — секторлар"}
        </PrimaryButton>
      </div>
    </AppShell>
  );
}
