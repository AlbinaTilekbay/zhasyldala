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

// The backend only discards an OpenAI vision result when it's *entirely*
// empty (see apps/ml/openai_vision.py) — a response that named the
// species/symptoms/status but left cause/treatment_steps/prevention_tips/
// encouragement blank (the model not following instructions perfectly)
// still comes through as a non-null `ai_narrative`. Callers should check
// this — not just `diag?.ai_narrative` truthiness — before deciding
// whether to show AiNarrative's cards or fall back to a plain
// recommendations list, so that edge case doesn't render an empty gap on
// the result screen.
export function narrativeHasCards(narrative) {
  if (!narrative) return false;
  return Boolean(
    narrative.cause || narrative.treatment_steps?.length || narrative.prevention_tips?.length ||
    narrative.encouragement || narrative.disease_type || narrative.health_percent > 0 ||
    narrative.humidity_level || narrative.sun_stress_level
  );
}

function capitalizeKk(text) {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

// "Жағдайы" — a compact health/humidity/sun-stress readout, ported from
// the structured status line in the author's proven Telegram-bot prompt
// (Денсаулық/Ылғалдылық/Күн стресі). Renders nothing if none of the three
// values came back.
function StatusStats({ narrative }) {
  const rows = [
    narrative.health_percent > 0 ? { label: "Денсаулық", value: `${narrative.health_percent}%` } : null,
    narrative.humidity_level ? { label: "Ылғалдылық", value: capitalizeKk(narrative.humidity_level) } : null,
    narrative.sun_stress_level ? { label: "Күн стресі", value: capitalizeKk(narrative.sun_stress_level) } : null,
  ].filter(Boolean);
  if (!rows.length) return null;
  return (
    <div className="card card-lg">
      <div style={{ font: "700 14px var(--font)", marginBottom: 12 }}>Жағдайы</div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${rows.length}, 1fr)`, gap: 10 }}>
        {rows.map((r) => (
          <div key={r.label} style={{ textAlign: "center" }}>
            <div style={{ font: "700 16px var(--font)", color: "var(--accent)" }}>{r.value}</div>
            <div style={{ font: "400 11px var(--font)", color: "var(--ink-mute)", marginTop: 3 }}>{r.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Renders the OpenAI vision diagnosis result (see backend
// apps/ml/openai_vision.py) as a set of clearly-labeled, emoji-free
// sections — the disease type (if any), a health/humidity/sun-stress
// status readout, a short cause paragraph, concrete treatment steps,
// prevention tips, and a closing encouragement highlight. Returns null
// (renders nothing) when there's no narrative yet — e.g. the offline
// fallback model answered instead — so callers can render it
// unconditionally.
export function AiNarrative({ narrative }) {
  if (!narrative) return null;
  const { disease_type, cause, treatment_steps, prevention_tips, encouragement } = narrative;
  return (
    <>
      {disease_type && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "-4px 2px 0" }}>
          <span style={{ font: "500 12px var(--font)", color: "var(--ink-mute)" }}>Ауру түрі:</span>
          <span style={{ font: "700 12px var(--font)", color: "var(--bad-ink)" }}>{capitalizeKk(disease_type)}</span>
        </div>
      )}
      <StatusStats narrative={narrative} />
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
