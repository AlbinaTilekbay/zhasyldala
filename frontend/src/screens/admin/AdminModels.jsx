import { useEffect, useState } from "react";
import { api } from "../../api/client";

export default function AdminModels() {
  const [versions, setVersions] = useState([]);
  const [busyId, setBusyId] = useState(null);

  async function refresh() {
    const data = await api.get("/api/admin/model-versions/");
    setVersions(data.results || data);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function activate(id) {
    setBusyId(id);
    try {
      await api.post(`/api/admin/model-versions/${id}/activate/`, {});
      refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="admin-card">
      <h2>Модель нұсқалары</h2>
      <p className="subtle" style={{ marginTop: -8, marginBottom: 14 }}>
        Тек "ready" статусындағы нұсқаны іске қосуға (activate) болады — ол дереу production диагностикада қолданыла бастайды.
      </p>
      <table className="admin-table">
        <thead>
          <tr><th>Атауы</th><th>Статус</th><th>Дәлдік</th><th>Суреттер саны</th><th>Іске қосылды</th><th></th></tr>
        </thead>
        <tbody>
          {versions.map((v) => (
            <tr key={v.id}>
              <td>{v.name}</td>
              <td><span className={`admin-pill pill-${v.status}`}>{v.status}</span></td>
              <td>{v.accuracy != null ? `${Math.round(v.accuracy * 100)}%` : "—"}</td>
              <td>{v.trained_from_count}</td>
              <td>{v.activated_at ? new Date(v.activated_at).toLocaleDateString("kk-KZ") : "—"}</td>
              <td>
                {v.status === "ready" && (
                  <button className="admin-btn" onClick={() => activate(v.id)} disabled={busyId === v.id}>
                    {busyId === v.id ? "…" : "Іске қосу"}
                  </button>
                )}
              </td>
            </tr>
          ))}
          {versions.length === 0 && <tr><td colSpan={6}>Әзірге оқытылған модель жоқ.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
