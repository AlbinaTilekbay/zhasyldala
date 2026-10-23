import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";

// Label rates exactly as packages print them: this much product in this
// much water covers this many m². The farmer copies the three numbers off
// the package instead of converting them to L/m² in their head (labels mix
// "per 100 m²", "per 10 m²" and "per sotka", and the old single "Шығын,
// л/м²" field made them do that arithmetic). Values are a starting point;
// every field stays editable because formulations differ between makers.
const PRODUCTS = [
  { key: "bordeaux", name: "Бордо сұйықтығы 1%", dose: 100, unit: "г", water: 10, cover: 100 },
  { key: "hom", name: "Мыс хлороқышы (ХОМ)", dose: 40, unit: "г", water: 10, cover: 100 },
  { key: "topaz", name: "Топаз (ақұнтаққа)", dose: 2, unit: "мл", water: 10, cover: 100 },
  { key: "custom", name: "Басқа препарат", dose: 10, unit: "г", water: 10, cover: 100 },
];
const str = (n) => String(n).replace(".", ",");

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

// How much solution and product to mix for the plan's affected sectors.
// Plain proportion from the label: if `dose` of product in `water` litres
// covers `cover` m², then area m² needs area ÷ cover of each. The sector
// area is saved on the greenhouse so it only has to be typed once.
export default function DoseCalculator({ greenhouseId, sectorCount, suggested }) {
  const [area, setArea] = useState("");
  const [productKey, setProductKey] = useState(suggested || "bordeaux");
  const [picked, setPicked] = useState(false);
  // The three label numbers, refilled from the preset whenever the product
  // changes, then free to edit.
  const [dose, setDose] = useState("");
  const [unit, setUnit] = useState("г");
  const [water, setWater] = useState("");
  const [cover, setCover] = useState("");
  const [sectors, setSectors] = useState(String(sectorCount || 1));

  // The suggestion arrives after the scan report loads; apply it unless the
  // farmer has already chosen a product by hand.
  useEffect(() => {
    if (suggested && !picked) setProductKey(suggested);
  }, [suggested, picked]);

  useEffect(() => {
    const p = PRODUCTS.find((x) => x.key === productKey) || PRODUCTS[0];
    setDose(str(p.dose)); setUnit(p.unit); setWater(str(p.water)); setCover(str(p.cover));
  }, [productKey]);

  // An auto-picked product (Topaz, "Басқа препарат") sits past the right
  // edge of the chip row on a phone, so the farmer couldn't see which one
  // the norm was computed for. Scroll the row — only the row, not the page
  // (scrollIntoView would also jump the page) — to the active chip.
  const chipsRef = useRef(null);
  useEffect(() => {
    const row = chipsRef.current;
    const chip = row?.querySelector(".chip-active");
    if (row && chip) row.scrollTo({ left: Math.max(0, chip.offsetLeft - 16), behavior: "smooth" });
  }, [productKey]);

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
  const totalArea = num(area) * num(sectors);
  const share = num(cover) > 0 ? totalArea / num(cover) : 0;
  const litres = share * num(water);
  const amount = share * num(dose);

  const field = (label, value, set, extra = {}) => (
    <label className="field" style={{ flex: 1, minWidth: 0, padding: "9px 12px 8px" }}>
      <div className="field-label">{label}</div>
      <input inputMode="decimal" value={value} onChange={(e) => set(e.target.value)} {...extra} />
    </label>
  );

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="chip-scroll" ref={chipsRef} style={{ margin: "0 -16px", padding: "0 16px 2px" }}>
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
      <div className="eyebrow" style={{ marginBottom: -4 }}>Қаптамада жазылғандай</div>
      <div style={{ display: "flex", gap: 8 }}>
        <label className="field" style={{ flex: 1.15, minWidth: 0, padding: "9px 12px 8px" }}>
          <div className="field-label">Препарат</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input inputMode="decimal" value={dose} onChange={(e) => setDose(e.target.value)} style={{ minWidth: 0, flex: 1 }} />
            <button
              type="button"
              className="chip chip-idle"
              onClick={() => setUnit((u) => (u === "г" ? "мл" : "г"))}
              aria-label="Өлшем бірлігін ауыстыру"
              style={{ padding: "4px 10px", fontSize: 13 }}
            >
              {unit}
            </button>
          </div>
        </label>
        {field("Су, л", water, setWater)}
        {field("Жетеді, м²", cover, setCover)}
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
          <div style={{ font: "600 26px/1.1 var(--mono)", color: "var(--ink)", marginTop: 4 }}>{fmt(amount)} <small style={{ fontSize: 13 }}>{unit}</small></div>
        </div>
      </div>
      <div style={{ font: "400 11.5px/1.5 var(--font)", color: "var(--ink-mute)" }}>
        {fmt(totalArea)} м² · бір секторға {fmt(num(sectors) ? litres / num(sectors) : 0)} л. Мөлшерді әрқашан препарат қаптамасындағы нұсқаумен салыстырыңыз.
      </div>
    </div>
  );
}
