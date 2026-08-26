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

  useEffect(() => {
    api.publicGet("/api/crops/").then((data) => setCrops(data.results || data));
  }, []);

  async function next() {
    if (!cropId) return;
    setBusy(true);
    try {
      await api.patch(`/api/greenhouses/${greenhouseId}/`, { crop_id: cropId });
      navigate("/setup/grid");
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
        <PrimaryButton onClick={next} disabled={!cropId || busy}>Әрі қарай — секторлар</PrimaryButton>
      </div>
    </AppShell>
  );
}
