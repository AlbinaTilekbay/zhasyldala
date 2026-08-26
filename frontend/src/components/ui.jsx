export function PrimaryButton({ children, ...props }) {
  return (
    <button className="btn btn-primary" {...props}>
      {children}
    </button>
  );
}

export function GhostButton({ children, ...props }) {
  return (
    <button className="btn btn-ghost" {...props}>
      {children}
    </button>
  );
}

export function DangerGhostButton({ children, ...props }) {
  return (
    <button className="btn btn-danger-ghost" {...props}>
      {children}
    </button>
  );
}

export function Spinner() {
  return <div className="spinner" />;
}

export function CenteredMessage({ title, body, children }) {
  return (
    <div
      style={{
        height: "100%", display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", gap: 18, padding: 40, textAlign: "center", minHeight: "60dvh",
      }}
    >
      {children}
      {title && <div className="title-md">{title}</div>}
      {body && <div className="subtle">{body}</div>}
    </div>
  );
}

export function Chip({ active, children, ...props }) {
  return (
    <button className={`chip ${active ? "chip-active" : "chip-idle"}`} {...props}>
      {children}
    </button>
  );
}

export function SeverityBadge({ severity }) {
  const map = {
    ok: { cls: "badge-ok", label: "Қалыпты" },
    warn: { cls: "badge-warn", label: "Назар қажет" },
    bad: { cls: "badge-bad", label: "Ауру" },
  };
  const entry = map[severity] || map.ok;
  return <span className={`badge ${entry.cls}`}>{entry.label}</span>;
}

export function NumberedList({ items }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map((text, i) => (
        <div className="numbered-item" key={i}>
          <div className="num">{i + 1}</div>
          <div style={{ font: "400 13px/1.5 var(--font)", color: "var(--ink-soft)" }}>{text}</div>
        </div>
      ))}
    </div>
  );
}

// Renders the OpenAI vision diagnosis result (see backend
// apps/ml/openai_vision.py) as a set of clearly-labeled, emoji-free
// sections — a short cause paragraph, concrete treatment steps,
// prevention tips, and a closing encouragement highlight. Returns null
// (renders nothing) when there's no narrative yet — e.g. the offline
// fallback model answered instead — so callers can render it
// unconditionally.
export function AiNarrative({ narrative }) {
  if (!narrative) return null;
  const { cause, treatment_steps, prevention_tips, encouragement } = narrative;
  return (
    <>
      {cause && (
        <div className="card card-lg">
          <div style={{ font: "700 14px var(--font)", marginBottom: 8 }}>Себебі</div>
          <div className="subtle">{cause}</div>
        </div>
      )}
      {treatment_steps?.length > 0 && (
        <div className="card card-lg">
          <div style={{ font: "700 14px var(--font)", marginBottom: 12 }}>Емдеу жолы</div>
          <NumberedList items={treatment_steps} />
        </div>
      )}
      {prevention_tips?.length > 0 && (
        <div className="card card-lg">
          <div style={{ font: "700 14px var(--font)", marginBottom: 12 }}>Алдын алу кеңестері</div>
          <BulletList items={prevention_tips} />
        </div>
      )}
      {encouragement && (
        <div
          className="card card-lg"
          style={{ background: "var(--accent-tint)", borderColor: "rgba(15,118,110,.18)" }}
        >
          <div style={{ font: "500 13px/1.6 var(--font)", color: "var(--accent-hover)" }}>{encouragement}</div>
        </div>
      )}
    </>
  );
}

export function BulletList({ items }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map((text, i) => (
        <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <span
            style={{
              width: 5, height: 5, borderRadius: "50%", background: "var(--accent)",
              marginTop: 7, flex: "none",
            }}
          />
          <div style={{ font: "400 13px/1.5 var(--font)", color: "var(--ink-soft)" }}>{text}</div>
        </div>
      ))}
    </div>
  );
}
