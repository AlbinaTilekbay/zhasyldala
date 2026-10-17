import { useEffect, useState } from "react";
import { api } from "../api/client";

// Common label rates per 10 L of water. Shown as a starting point only —
// the farmer is told to check the package (formulations differ).
const PRODUCTS = [
  { key: "bordeaux", name: "Бордо сұйықтығы 1%", dose: 100, unit: "г" },
  { key: "hom", name: "Мыс хлороқышы (ХОМ)", dose: 40, unit: "г" },
  { key: "topaz", name: "Топаз (ақұнтаққа)", dose: 2, unit: "мл" },
  { key: "custom", name: "Басқа препарат", dose: 10, unit: "г" },
];

function num(v, fallback = 0) {
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function fmt(n) {
  return n >= 10 ? Math.round(n).toString() : (Math.round(n * 10) / 10).toString().replace(".", ",");
}

// How much solution and product to mix for the plan's affected sectors:
// area (m²) × spray rate (L/m²) = litres of solution; litres ÷ 10 × the
// product's dose per 10 L = grams/ml of product. The sector area is
// saved on the greenhouse so it only has to be typed once.
export default function DoseCalculator({ greenhouseId, sectorCount }) {
  const [area, setArea] = useState("");
  const [rate, setRate] = useState("0,1");
  const [productKey, setProductKey] = useState("bordeaux");
  const [customDose, setCustomDose] = useState("10");
  const [sectors, setSectors] = useState(String(sectorCount || 1));

  useEffect(() => {
    api.get(`/api/greenhouses/${greenhouseId}/`).then((gh) => setArea(gh.sector_area_m2 ? String(gh.sector_area_m2).replace(".", ",") : "10")).catch(() => setArea("10"));
  }, [greenhouseId]);

  function saveArea() {
    const value = num(area, 0);
    if (value > 0) api.patch(`/api/greenhouses/${greenhouseId}/`, { sector_area_m2: value }).catch(() => {});
  }

  const product = PRODUCTS.find((p) => p.key === productKey);
  const dose = productKey === "custom" ? num(customDose) : product.dose;
  const totalArea = num(area) * num(sectors);
  const litres = totalArea * num(rate);
  const amount = (litres / 10) * dose;

  const field = (label, value, set, extra = {}) => (
    <label className="field" style={{ flex: 1, minWidth: 0, padding: "9px 12px 8px" }}>
      <div className="field-label">{label}</div>
      <input inputMode="decimal" value={value} onChange={(e) => set(e.target.value)} {...extra} />
    </label>
  );

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="chip-scroll" style={{ margin: "0 -16px", padding: "0 16px 2px" }}>
        {PRODUCTS.map((p) => (
          <button key={p.key} className={`chip ${p.key === productKey ? "chip-active" : "chip-idle"}`} onClick={() => setProductKey(p.key)}>
            {p.name}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {field("Сектор ауданы, м²", area, setArea, { onBlur: saveArea })}
        {field("Сектор саны", sectors, setSectors, { inputMode: "numeric" })}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {field("Шығын, л/м²", rate, setRate)}
        {productKey === "custom"
          ? field("Мөлшер / 10 л", customDose, setCustomDose)
          : (
            <div className="field" style={{ flex: 1, padding: "9px 12px 8px", background: "transparent" }}>
              <div className="field-label">Мөлшер / 10 л</div>
              <div className="field-value">{product.dose} {product.unit}</div>
            </div>
          )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderTop: "1px solid var(--ink-hairline)", paddingTop: 12 }}>
        <div>
          <div className="eyebrow">Ерітінді</div>
          <div style={{ font: "600 26px/1.1 var(--mono)", color: "var(--accent)", marginTop: 4 }}>{fmt(litres)} <small style={{ fontSize: 13 }}>л</small></div>
        </div>
        <div style={{ borderLeft: "1px solid var(--ink-hairline)", paddingLeft: 14 }}>
          <div className="eyebrow">Препарат</div>
          <div style={{ font: "600 26px/1.1 var(--mono)", color: "var(--ink)", marginTop: 4 }}>{fmt(amount)} <small style={{ fontSize: 13 }}>{product.unit}</small></div>
        </div>
      </div>
      <div style={{ font: "400 11.5px/1.5 var(--font)", color: "var(--ink-mute)" }}>
        {fmt(totalArea)} м² · бір секторға {fmt(num(sectors) ? litres / num(sectors) : 0)} л. Мөлшерді әрқашан препарат қаптамасындағы нұсқаумен салыстырыңыз.
      </div>
    </div>
  );
}
