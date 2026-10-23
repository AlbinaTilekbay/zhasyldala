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

// Picks the product that fits the diseases this scan found, so the farmer
// doesn't start from Bordeaux mixture for, say, powdery mildew. The most
// frequent fungal disease wins. Mites are not treated by any preset (they
// need an acaricide), so a mites-only scan opens "Басқа препарат" for the
// farmer to type the label dose. Returns null when nothing matches.
export function suggestProduct(diseaseNames) {
  const votes = {};
  let mites = false;
  for (const raw of diseaseNames) {
    const name = String(raw || "").toLowerCase();
    if (name.includes("кене")) mites = true;
    if (!name || name.includes("кене")) continue;
    let key = null;
    if (name.includes("жалған") || name.includes("пероноспороз") || name.includes("фитофтороз") || name.includes("бактерия") || name.includes("дақ")) key = "hom";
    else if (name.includes("ақұнтақ")) key = "topaz";
    if (key) votes[key] = (votes[key] || 0) + 1;
  }
  const best = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
  if (best) return best[0];
  return mites ? "custom" : null;
}

function num(v, fallback = 0) {
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

// Small doses need their decimals: 14,4 g of ХОМ or 0,96 ml of Topaz is
// what actually goes in the sprayer, and rounding them to "14" / "1"
// overstated or blurred the amount. Only 100+ is shown as a whole number.
function fmt(n) {
  const digits = n >= 100 ? 0 : n >= 1 ? 1 : 2;
  const f = 10 ** digits;
  return (Math.round(n * f) / f).toString().replace(".", ",");
}

// How much solution and product to mix for the plan's affected sectors:
// area (m²) × spray rate (L/m²) = litres of solution; litres ÷ 10 × the
// product's dose per 10 L = grams/ml of product. The sector area is
// saved on the greenhouse so it only has to be typed once.
export default function DoseCalculator({ greenhouseId, sectorCount, suggested }) {
  const [area, setArea] = useState("");
  const [rate, setRate] = useState("0,1");
  const [productKey, setProductKey] = useState(suggested || "bordeaux");
  const [picked, setPicked] = useState(false);
  const [customDose, setCustomDose] = useState("10");
  const [sectors, setSectors] = useState(String(sectorCount || 1));

  // The suggestion arrives after the scan report loads; apply it unless the
  // farmer has already chosen a product by hand.
  useEffect(() => {
    if (suggested && !picked) setProductKey(suggested);
  }, [suggested, picked]);

  // The sector area normally comes from setup (greenhouse area ÷ sectors).
  // When it's missing we leave the field empty and say so, instead of the
  // old silent 10 m² guess — a made-up area gave a confident-looking but
  // wrong dose.
  const [areaNote, setAreaNote] = useState(null);
  useEffect(() => {
    api.get(`/api/greenhouses/${greenhouseId}/`)
      .then((gh) => {
        if (gh.sector_area_m2) setArea(String(gh.sector_area_m2).replace(".", ","));
        else setAreaNote("Бір сектордың ауданын жазыңыз — норма содан кейін есептеледі.");
      })
      .catch(() => setAreaNote("Сектор ауданы жүктелмеді — қолмен жазыңыз."));
  }, [greenhouseId]);

  function saveArea() {
    const value = num(area, 0);
    if (value > 0) {
      setAreaNote(null);
      api.patch(`/api/greenhouses/${greenhouseId}/`, { sector_area_m2: value })
        .catch(() => setAreaNote("Аудан сақталмады — келесі жолы қайта жазу керек болуы мүмкін."));
    }
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
          <button key={p.key} className={`chip ${p.key === productKey ? "chip-active" : "chip-idle"}`} onClick={() => { setPicked(true); setProductKey(p.key); }}>
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
      {areaNote && <div className="form-error">{areaNote}</div>}
      <div className="eyebrow" style={{ borderTop: "1px solid var(--ink-hairline)", paddingTop: 12 }}>
        Ұсынылатын норма · {product.name}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", marginTop: -6 }}>
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
