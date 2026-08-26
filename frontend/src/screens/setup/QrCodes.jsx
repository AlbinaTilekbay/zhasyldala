import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import QrImage from "../../components/QrImage";
import { TopBar } from "../../components/TopBar";
import AppShell from "../../components/AppShell";
import { PrimaryButton } from "../../components/ui";
import { useSetupStore } from "../../store/useSetupStore";

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

export default function QrCodes() {
  const navigate = useNavigate();
  const greenhouseId = useSetupStore((s) => s.greenhouseId);
  const reset = useSetupStore((s) => s.reset);
  const [greenhouse, setGreenhouse] = useState(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    api.get(`/api/greenhouses/${greenhouseId}/`).then(setGreenhouse);
  }, [greenhouseId]);

  async function downloadPdf() {
    setDownloading(true);
    try {
      const blob = await api.get(`/api/greenhouses/${greenhouseId}/sectors/qr-sheet.pdf`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${greenhouse?.name || "zhasyldala"}-qr.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  function finish() {
    reset();
    navigate("/app");
  }

  const rows = greenhouse ? chunk(greenhouse.sectors, greenhouse.cols) : [];

  return (
    <AppShell>
      <div className="screen-pad">
        <TopBar to="/setup/grid" title="Сектор QR белгілері" />
        <p className="subtle">
          Белгілерді басып шығарып, әр сектордың басына кеуде тұсынан іліп қойыңыз. Белгі видеоны нақты
          орынға байлайды — сол арқылы сектор өзінің бұрынғы жағдайымен салыстырылады.
        </p>
        <div className="sector-grid">
          {rows.map((row, i) => (
            <div className="sector-row" key={i}>
              {row.map((sector) => (
                <div key={sector.id} className="card" style={{ flex: 1, padding: 9, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <QrImage sectorId={sector.id} />
                  <div style={{ font: "700 11.5px var(--font)" }}>{sector.label}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={downloadPdf} disabled={downloading}>
            {downloading ? "Дайындалуда…" : "PDF жүктеу"}
          </button>
          <PrimaryButton style={{ flex: 1 }} onClick={finish}>Дайын</PrimaryButton>
        </div>
      </div>
    </AppShell>
  );
}
