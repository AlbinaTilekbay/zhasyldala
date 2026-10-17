import { useState } from "react";
import { api } from "../api/client";

async function downloadBlob(path, filename, isPublic) {
  const blob = isPublic ? await api.publicGet(path) : await api.get(path);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// "Агрономға жіберу": a read-only public link (phone share sheet when
// available, otherwise copied to the clipboard) plus the one-page PDF.
export default function ShareReport({ sessionId, dateLabel }) {
  const [link, setLink] = useState(null);
  const [state, setState] = useState(null); // "copied" | "shared" | "error"
  const [busy, setBusy] = useState(null);

  async function share() {
    setBusy("link");
    setState(null);
    try {
      const { token } = await api.post(`/api/scan-sessions/${sessionId}/share/`, {});
      const url = `${window.location.origin}/s/${token}`;
      setLink(url);
      // The share sheet can stay open indefinitely — don't keep the
      // buttons disabled while it does.
      setBusy(null);
      if (navigator.share) {
        try {
          await navigator.share({ title: "ZhasylDala — жылыжай есебі", text: `Жылыжай есебі, ${dateLabel}`, url });
          setState("shared");
          return;
        } catch {
          // share sheet dismissed — fall through to copying
        }
      }
      await navigator.clipboard.writeText(url);
      setState("copied");
    } catch {
      setState(link ? "copy-failed" : "error");
    } finally {
      setBusy(null);
    }
  }

  async function pdf() {
    setBusy("pdf");
    try {
      await downloadBlob(`/api/scan-sessions/${sessionId}/pdf/`, `zhasyldala-esep-${sessionId}.pdf`);
    } catch {
      setState("error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={share} disabled={!!busy}>
          {busy === "link" ? "…" : "Сілтемемен бөлісу"}
        </button>
        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={pdf} disabled={!!busy}>
          {busy === "pdf" ? "Дайындалуда…" : "PDF жүктеу"}
        </button>
      </div>
      {link && (
        <div className="mono" style={{ fontSize: 11.5, padding: "8px 10px", border: "1px dashed var(--ink-hairline)", borderRadius: 6, wordBreak: "break-all", color: "var(--ink-soft)" }}>
          {link}
        </div>
      )}
      {state === "copied" && <div style={{ font: "500 12.5px var(--font)", color: "var(--accent)" }}>Сілтеме көшірілді — WhatsApp не Telegram арқылы агрономға жіберіңіз.</div>}
      {state === "shared" && <div style={{ font: "500 12.5px var(--font)", color: "var(--accent)" }}>Жіберілді.</div>}
      {state === "copy-failed" && <div style={{ font: "500 12.5px var(--font)", color: "var(--ink-mute)" }}>Сілтемені жоғарыдан көшіріп алыңыз.</div>}
      {state === "error" && <div className="form-error">Дайындалмады — интернетті тексеріңіз.</div>}
      <div style={{ font: "400 11.5px/1.5 var(--font)", color: "var(--ink-mute)" }}>
        Сілтеме бойынша тек осы есепті көруге болады — аккаунтыңызға кіру мүмкін емес.
      </div>
    </div>
  );
}
