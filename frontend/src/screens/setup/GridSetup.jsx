import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import AppShell from "../../components/AppShell";
import { TopBar } from "../../components/TopBar";
import { PrimaryButton } from "../../components/ui";
import { useSetupStore } from "../../store/useSetupStore";

const ROW_LETTERS = "ABCDE";

function previewRows(rows, cols) {
  const out = [];
  for (let i = 0; i < rows; i++) {
    const cells = [];
    for (let j = 0; j < cols; j++) cells.push(`${ROW_LETTERS[i]}${j + 1}`);
    out.push(cells);
  }
  return out;
}

export default function GridSetup() {
  const navigate = useNavigate();
  const greenhouseId = useSetupStore((s) => s.greenhouseId);
  const presetLabel = useSetupStore((s) => s.presetLabel);
  const setPresetLabel = useSetupStore((s) => s.setPresetLabel);
  const [presets, setPresets] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.publicGet("/api/sector-grid-presets/").then(setPresets);
  }, []);

  const selected = presets.find((p) => p.label === presetLabel) || presets[1];

  async function next() {
    setBusy(true);
    try {
      await api.post(`/api/greenhouses/${greenhouseId}/sectors/generate/`, { preset_label: presetLabel });
      navigate("/setup/qr");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="screen-pad">
        <TopBar to="/setup/crop" subtitle="3-қадам / 3" title="" />
        <div>
          <div className="title-lg">Жылыжайды бөлу</div>
          <p className="subtle" style={{ marginTop: 8 }}>
            Жылыжайды секторға бөліңіз — қатар мен жүйек сияқты. Бір сектор = шолу кезіндегі бір видео.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {presets.map((p) => (
            <button
              key={p.label}
              onClick={() => setPresetLabel(p.label)}
              className={p.label === presetLabel ? "chip chip-active" : "chip chip-idle"}
              style={{ flex: 1, padding: "14px 0", borderRadius: 14, textAlign: "center" }}
            >
              <div style={{ font: "700 15px var(--font)" }}>{p.label}</div>
              <div style={{ font: "500 11px var(--font)", opacity: 0.7, marginTop: 3 }}>{p.sub}</div>
            </button>
          ))}
        </div>
        {selected && (
          <div className="card card-lg" style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            <div style={{ font: "600 12px var(--font)", color: "var(--ink-faint)" }}>Карта нобайы</div>
            <div className="sector-grid">
              {previewRows(selected.rows, selected.cols).map((row) => (
                <div className="sector-row" key={row.join()}>
                  {row.map((label) => (
                    <div
                      key={label}
                      style={{
                        flex: 1, aspectRatio: 1, borderRadius: 11, background: "var(--unscanned-tint)",
                        border: "1px solid var(--ink-hairline)", display: "flex", alignItems: "center",
                        justifyContent: "center", font: "600 12px var(--font)", color: "var(--ink-mute)",
                      }}
                    >
                      {label}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
        <PrimaryButton onClick={next} disabled={busy}>QR белгілерін жасау</PrimaryButton>
      </div>
    </AppShell>
  );
}
