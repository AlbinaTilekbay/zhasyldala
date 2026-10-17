import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import QrImage from "../../components/QrImage";
import { TopBar } from "../../components/TopBar";
import AppShell from "../../components/AppShell";
import { PrimaryButton, SectionHead, Spinner, StepBar } from "../../components/ui";
import { useSetupStore } from "../../store/useSetupStore";

// Groups sectors by their actual `row` — rows aren't always the same
// length (see GridSetup.jsx's custom row-count mode).
function groupByRow(sectors) {
  const out = [];
  let currentRow = null;
  for (const s of sectors) {
    if (s.row !== currentRow) {
      out.push([]);
      currentRow = s.row;
    }
    out[out.length - 1].push(s);
  }
  return out;
}

async function download(path, filename) {
  const blob = await api.get(path);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Reached two ways: the last step of the setup wizard (greenhouseId in
// the wizard store), or later from Profile → "QR белгілер" — the wizard
// store is empty by then, so fall back to the farmer's own greenhouse
// instead of requesting /api/greenhouses/null/.
export default function QrCodes() {
  const navigate = useNavigate();
  const wizardGreenhouseId = useSetupStore((s) => s.greenhouseId);
  const reset = useSetupStore((s) => s.reset);
  const inWizard = Boolean(wizardGreenhouseId);
  const [greenhouse, setGreenhouse] = useState(null);
  const [downloading, setDownloading] = useState(null); // "rows" | "sectors" | null
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        if (wizardGreenhouseId) {
          setGreenhouse(await api.get(`/api/greenhouses/${wizardGreenhouseId}/`));
        } else {
          const list = await api.get("/api/greenhouses/");
          setGreenhouse((list.results || list)[0] || null);
        }
      } catch {
        setError("Жылыжай жүктелмеді.");
      }
    })();
  }, [wizardGreenhouseId]);

  async function get(kind) {
    setDownloading(kind);
    setError(null);
    try {
      if (kind === "rows") await download(`/api/greenhouses/${greenhouse.id}/rows/qr-sheet.pdf`, "zhasyldala-qatarlar.pdf");
      else await download(`/api/greenhouses/${greenhouse.id}/sectors/qr-sheet.pdf`, "zhasyldala-sektorlar.pdf");
    } catch {
      setError("PDF жүктелмеді. Қайталап көріңіз.");
    } finally {
      setDownloading(null);
    }
  }

  function finish() {
    reset();
    navigate("/app");
  }

  const rows = greenhouse ? groupByRow(greenhouse.sectors) : [];

  return (
    <AppShell>
      <div className="screen-pad">
        <TopBar to={inWizard ? "/setup/grid" : "/app/profile"} title="QR белгілер" />
        {inWizard && <StepBar step={3} />}
        <div>
          <h1 className="title-lg" style={{ margin: 0 }}>{inWizard ? "Белгілерді басып шығарыңыз" : "QR белгілер"}</h1>
          <p className="subtle" style={{ marginTop: 8 }}>
            Ең оңайы — әр қатардың басына бір белгі. Сканерлегенде қосымша сол қатардың келесі секторын ашады.
          </p>
        </div>

        {!greenhouse && !error && <div style={{ display: "flex", justifyContent: "center", padding: 30 }}><Spinner /></div>}

        {greenhouse && (
          <>
            <SectionHead no={1} title="Қатар белгілері" aside={`${rows.length} бет · A4`} />
            <div className="card" style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1 }}>
                <div style={{ font: "600 14px var(--font)" }}>Ұсынылады</div>
                <div style={{ font: "400 12.5px/1.5 var(--font)", color: "var(--ink-mute)" }}>
                  Бір қатар — бір парақ. Жылыжай торын кейін өзгертсеңіз де, белгілер жарамды болып қалады.
                </div>
              </div>
            </div>
            <PrimaryButton onClick={() => get("rows")} disabled={!!downloading}>
              {downloading === "rows" ? "Дайындалуда…" : "Қатар белгілерін жүктеу (PDF)"}
            </PrimaryButton>

            <SectionHead no={2} title="Әр секторға жеке" aside={`${greenhouse.sectors.length} белгі`} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {rows.map((row, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: `16px repeat(${Math.max(...rows.map((r) => r.length))}, minmax(0, 1fr))`, gap: 6, alignItems: "center" }}>
                  <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-faint)" }}>{row[0]?.label.replace(/\d+$/, "")}</span>
                  {row.map((sector) => (
                    <div key={sector.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: 5, border: "1px solid var(--ink-hairline)", borderRadius: 6, background: "var(--bg-card)" }}>
                      <QrImage sectorId={sector.id} />
                      <span className="mono" style={{ fontSize: 10.5, fontWeight: 600 }}>{sector.label}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <button className="btn btn-ghost" onClick={() => get("sectors")} disabled={!!downloading}>
              {downloading === "sectors" ? "Дайындалуда…" : "Сектор белгілерін жүктеу (PDF)"}
            </button>
          </>
        )}
        {error && <div className="form-error">{error}</div>}
        {inWizard && <PrimaryButton onClick={finish}>Дайын — басты бетке</PrimaryButton>}
      </div>
    </AppShell>
  );
}
