import { useEffect, useState } from "react";
import { api, mediaUrl } from "../../api/client";

export default function AdminDataset() {
  const [crops, setCrops] = useState([]);
  const [diseases, setDiseases] = useState([]);
  const [summary, setSummary] = useState([]);
  const [images, setImages] = useState([]);
  const [form, setForm] = useState({ crop: "", disease: "", file: null });
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const [imgRes, summaryRes] = await Promise.all([
      api.get("/api/admin/training-images/"),
      api.get("/api/admin/training-images/summary/"),
    ]);
    setImages(imgRes.results || imgRes);
    setSummary(summaryRes);
  }

  useEffect(() => {
    api.publicGet("/api/crops/").then((data) => setCrops(data.results || data));
    refresh();
  }, []);

  useEffect(() => {
    if (!form.crop) return setDiseases([]);
    api.publicGet(`/api/diseases/?crop=${form.crop}`).then((data) => setDiseases(data.results || data));
  }, [form.crop]);

  async function upload(e) {
    e.preventDefault();
    if (!form.file) return;
    setBusy(true);
    try {
      const body = new FormData();
      body.append("image", form.file);
      if (form.crop) body.append("crop", form.crop);
      if (form.disease) body.append("disease", form.disease);
      body.append("source", "admin_upload");
      await api.post("/api/admin/training-images/", body, { isForm: true });
      setForm({ ...form, file: null });
      e.target.reset();
      refresh();
    } finally {
      setBusy(false);
    }
  }

  async function verify(id) {
    await api.post(`/api/admin/training-images/${id}/verify/`, {});
    refresh();
  }

  return (
    <>
      <div className="admin-card">
        <h2>Жаңа сурет жүктеу</h2>
        <form className="admin-form-row" onSubmit={upload}>
          <input type="file" accept="image/*" onChange={(e) => setForm({ ...form, file: e.target.files[0] })} required />
          <select value={form.crop} onChange={(e) => setForm({ ...form, crop: e.target.value, disease: "" })}>
            <option value="">Дақыл таңдаңыз</option>
            {crops.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={form.disease} onChange={(e) => setForm({ ...form, disease: e.target.value })}>
            <option value="">Дені сау (ауру жоқ)</option>
            {diseases.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <button className="admin-btn" type="submit" disabled={busy}>{busy ? "Жүктелуде…" : "Жүктеу"}</button>
        </form>
      </div>

      <div className="admin-card">
        <h2>Деректер жиынының жағдайы</h2>
        <table className="admin-table">
          <thead>
            <tr><th>Дақыл</th><th>Ауру</th><th>Расталған</th><th>Расталмаған</th></tr>
          </thead>
          <tbody>
            {summary.map((row, i) => (
              <tr key={i}>
                <td>{row.crop || "—"}</td>
                <td>{row.disease || "дені сау"}</td>
                <td>{row.verified_count}</td>
                <td>{row.unverified_count}</td>
              </tr>
            ))}
            {summary.length === 0 && <tr><td colSpan={4}>Әзірге сурет жоқ.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="admin-card">
        <h2>Соңғы жүктелген суреттер</h2>
        <table className="admin-table">
          <thead>
            <tr><th>Сурет</th><th>Дақыл</th><th>Ауру</th><th>Дереккөз</th><th>Расталған</th><th></th></tr>
          </thead>
          <tbody>
            {images.map((img) => (
              <tr key={img.id}>
                <td><img src={mediaUrl(img.image)} alt="" width={48} height={48} style={{ borderRadius: 8, objectFit: "cover" }} /></td>
                <td>{img.crop_name || "—"}</td>
                <td>{img.disease_name || "дені сау"}</td>
                <td>{img.source}</td>
                <td>{img.verified ? "✓" : "—"}</td>
                <td>{!img.verified && <button className="admin-btn" onClick={() => verify(img.id)}>Растау</button>}</td>
              </tr>
            ))}
            {images.length === 0 && <tr><td colSpan={6}>Әзірге сурет жоқ.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
