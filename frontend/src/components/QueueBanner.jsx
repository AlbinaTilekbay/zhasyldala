import { useQueueState } from "../offline/useQueueState";

// Thin strip shown while walkthrough uploads are waiting in the phone's
// offline queue — reassures the farmer nothing was lost.
export default function QueueBanner({ dark = false }) {
  const { pending, photos, offline } = useQueueState();
  if (!pending) return null;
  const text = offline
    ? `Желі жоқ — ${photos ? `${photos} фото ` : ""}телефонда сақталды, байланыс болғанда өзі жіберіледі`
    : `Жіберілуде… ${photos ? `${photos} фото` : `${pending} әрекет`} қалды`;
  return (
    <div
      role="status"
      style={{
        display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8,
        font: "500 12px/1.4 var(--font)",
        background: dark ? "rgba(255,255,255,.08)" : offline ? "var(--warn-tint)" : "var(--accent-tint)",
        color: dark ? "rgba(255,255,255,.85)" : offline ? "var(--warn-ink)" : "var(--accent-hover)",
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: "50%", flex: "none", background: offline ? "var(--warn)" : "var(--scan-line)", animation: "gg-pulse 1.2s infinite" }} />
      {text}
    </div>
  );
}
