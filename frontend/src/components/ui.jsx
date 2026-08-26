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
