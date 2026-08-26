import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import AppShell from "../../components/AppShell";
import { TopBar } from "../../components/TopBar";
import { PrimaryButton } from "../../components/ui";
import { useSetupStore } from "../../store/useSetupStore";

const ROW_LETTERS = "ABCDE";
const MAX_ROWS = ROW_LETTERS.length;
const DEFAULT_CUSTOM_ROWS = [6, 6, 4];

function previewRows(rowCounts) {
  return rowCounts.map((count, i) => {
    const cells = [];
    for (let j = 0; j < count; j++) cells.push(`${ROW_LETTERS[i]}${j + 1}`);
    return cells;
  });
}

// Ports the mockup's "Жылыжайды бөлу" screen, extended with a "Өзім
// жазамын" mode: real greenhouses aren't always a clean rectangle — a row
// can end early against a wall, a path, a support post, etc. — so besides
// the 3 quick rectangular presets, the farmer can type exactly how many
// sectors each row has (e.g. 6, 6, 4).
export default function GridSetup() {
  const navigate = useNavigate();
  const greenhouseId = useSetupStore((s) => s.greenhouseId);
  const presetLabel = useSetupStore((s) => s.presetLabel);
  const setPresetLabel = useSetupStore((s) => s.setPresetLabel);
  const [presets, setPresets] = useState([]);
  const [mode, setMode] = useState("preset"); // preset | custom
  const [customRows, setCustomRows] = useState(DEFAULT_CUSTOM_ROWS);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.publicGet("/api/sector-grid-presets/").then(setPresets);
  }, []);

  const selected = presets.find((p) => p.label === presetLabel) || presets[1];
  const previewRowCounts = mode === "custom" ? customRows : selected ? Array(selected.rows).fill(selected.cols) : [];
  const customTotal = customRows.reduce((a, b) => a + b, 0);

  function updateCustomRow(i, value) {
    const n = Math.max(1, Math.min(30, Number(value) || 1));
    setCustomRows((rows) => rows.map((r, idx) => (idx === i ? n : r)));
  }

  function addCustomRow() {
    setCustomRows((rows) => (rows.length >= MAX_ROWS ? rows : [...rows, rows[rows.length - 1] || 4]));
  }

  function removeCustomRow(i) {
    setCustomRows((rows) => (rows.length <= 1 ? rows : rows.filter((_, idx) => idx !== i)));
  }

  async function next() {
    setBusy(true);
    try {
      const body = mode === "custom" ? { row_counts: customRows } : { preset_label: presetLabel };
      await api.post(`/api/greenhouses/${greenhouseId}/sectors/generate/`, body);
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
            Жылыжайды секторға бөліңіз — қатар мен жүйек сияқты. Бір сектор = шолу кезіндегі бір фото топтамасы.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => setMode("preset")}
            className={mode === "preset" ? "chip chip-active" : "chip chip-idle"}
            style={{ flex: 1, padding: "10px 0", borderRadius: 12, textAlign: "center" }}
          >
            Дайын үлгілер
          </button>
          <button
            onClick={() => setMode("custom")}
            className={mode === "custom" ? "chip chip-active" : "chip chip-idle"}
            style={{ flex: 1, padding: "10px 0", borderRadius: 12, textAlign: "center" }}
          >
            Өзім жазамын
          </button>
        </div>

        {mode === "preset" ? (
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
        ) : (
          <div className="card card-lg" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ font: "600 12px var(--font)", color: "var(--ink-faint)" }}>
              Әр қатарға неше сектор болатынын жазыңыз
            </div>
            {customRows.map((count, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 20, font: "700 13px var(--font)", color: "var(--ink-mute)" }}>{ROW_LETTERS[i]}</div>
                <label className="field" style={{ flex: 1, padding: "8px 14px" }}>
                  <div className="field-label">{i + 1}-қатар — сектор саны</div>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={count}
                    onChange={(e) => updateCustomRow(i, e.target.value)}
                  />
                </label>
                <button
                  className="icon-btn"
                  onClick={() => removeCustomRow(i)}
                  disabled={customRows.length <= 1}
                  style={{ opacity: customRows.length <= 1 ? 0.35 : 1 }}
                >
                  ✕
                </button>
              </div>
            ))}
            <button className="btn btn-ghost" onClick={addCustomRow} disabled={customRows.length >= MAX_ROWS}>
              + Қатар қосу
            </button>
            <div className="subtle">Барлығы: {customTotal} сектор ({customRows.length} қатар)</div>
          </div>
        )}

        {previewRowCounts.length > 0 && (
          <div className="card card-lg" style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            <div style={{ font: "600 12px var(--font)", color: "var(--ink-faint)" }}>Карта нобайы</div>
            <div className="sector-grid">
              {previewRows(previewRowCounts).map((row) => (
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
