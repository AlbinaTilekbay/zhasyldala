import { useEffect, useState } from "react";
import { api } from "../../api/client";

export default function AdminJobs() {
  const [jobs, setJobs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function refresh() {
    const data = await api.get("/api/admin/training-jobs/");
    setJobs(data.results || data);
  }

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 4000); // poll while a job may be running
    return () => clearInterval(interval);
  }, []);

  async function trigger() {
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/admin/training-jobs/", {});
      refresh();
    } catch (err) {
      setError(err.data?.detail || "Оқытуды бастау сәтсіз аяқталды.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="admin-card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>Жаңа оқыту тапсырмасы</h2>
          <div className="subtle">Барлық расталған суреттер бойынша модельді қайта оқытады (кемінде 10 керек).</div>
        </div>
        <button className="admin-btn" onClick={trigger} disabled={busy}>{busy ? "Басталуда…" : "Оқытуды бастау"}</button>
      </div>
      {error && <div style={{ color: "var(--bad)", font: "500 13px var(--font)" }}>{error}</div>}

      <div className="admin-card">
        <h2>Тапсырмалар тарихы</h2>
        <table className="admin-table">
          <thead>
            <tr><th>ID</th><th>Статус</th><th>Модель нұсқасы</th><th>Басталды</th><th>Аяқталды</th></tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id}>
                <td>#{job.id}</td>
                <td><span className={`admin-pill pill-${job.status}`}>{job.status}</span></td>
                <td>{job.model_version?.name || "—"}</td>
                <td>{new Date(job.created_at).toLocaleString("kk-KZ")}</td>
                <td>{job.finished_at ? new Date(job.finished_at).toLocaleString("kk-KZ") : "—"}</td>
              </tr>
            ))}
            {jobs.length === 0 && <tr><td colSpan={5}>Тапсырмалар жоқ.</td></tr>}
          </tbody>
        </table>
      </div>

      {jobs[0]?.log && (
        <div className="admin-card">
          <h2>Соңғы тапсырма журналы (#{jobs[0].id})</h2>
          <pre style={{ whiteSpace: "pre-wrap", font: "400 12px var(--mono)", color: "var(--ink-soft)", margin: 0 }}>
            {jobs[0].log}
          </pre>
        </div>
      )}
    </>
  );
}
