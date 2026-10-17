export function ArrowIcon({ className = "btn-arrow" }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 10h11.5M11 5.5 15.5 10 11 14.5" />
    </svg>
  );
}

// `arrow` (on by default) puts the label on the left and an arrow on the
// right — the button reads as "go to the next step". Pass arrow={false}
// for short two-up buttons where a centered label fits better.
export function PrimaryButton({ children, arrow = true, className = "", ...props }) {
  return (
    <button className={`btn btn-primary${arrow ? " has-arrow" : ""} ${className}`} {...props}>
      <span>{children}</span>
      {arrow && <ArrowIcon />}
    </button>
  );
}

export function GhostButton({ children, className = "", ...props }) {
  return (
    <button className={`btn btn-ghost ${className}`} {...props}>
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

// "02 ── Емдеу жоспары ──────── 2/5" — the journal-style section header
// used instead of a card title on every content screen.
export function SectionHead({ no, title, aside }) {
  return (
    <div className="sec">
      {no != null && <span className="sec-no">{String(no).padStart(2, "0")}</span>}
      <span className="sec-title">{title}</span>
      <span className="sec-rule" />
      {aside != null && <span className="sec-aside">{aside}</span>}
    </div>
  );
}

export function StepBar({ step, total = 3 }) {
  return (
    <div className="stepbar">
      <div className="stepbar-segs">
        {Array.from({ length: total }, (_, i) => <span key={i} className={i < step ? "on" : ""} />)}
      </div>
      <span className="eyebrow">{String(step).padStart(2, "0")} / {String(total).padStart(2, "0")}</span>
    </div>
  );
}

export function CheckBox({ on }) {
  return (
    <span className={`check${on ? " on" : ""}`}>
      {on && (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2.5 7.2 5.6 10.2 11.5 3.8" />
        </svg>
      )}
    </span>
  );
}

const KK_MONTHS = ["қаңтар", "ақпан", "наурыз", "сәуір", "мамыр", "маусым", "шілде", "тамыз", "қыркүйек", "қазан", "қараша", "желтоқсан"];

// Browsers' kk-KZ locale data is patchy (several render "2026-10-17" or
// Russian month names), so dates are formatted by hand: "17 қазан".
export function formatKkDate(value, { withYear = false } = {}) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getDate()} ${KK_MONTHS[d.getMonth()]}${withYear ? ` ${d.getFullYear()}` : ""}`;
}

export function daysAgoKk(value) {
  if (!value) return "";
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86400000);
  if (days <= 0) return "бүгін";
  if (days === 1) return "кеше";
  return `${days} күн бұрын`;
}

export const STATUS_META = {
  ok: { label: "қалыпты", fill: "fill-ok", color: "var(--accent)" },
  warn: { label: "қауіп", fill: "fill-warn", color: "var(--warn)" },
  bad: { label: "ауру", fill: "fill-bad", color: "var(--bad)" },
  unscanned: { label: "түсірілмеген", fill: "fill-unscanned", color: "var(--unscanned-ink)" },
  unknown: { label: "анықталмады", fill: "fill-unknown", color: "var(--ink-mute)" },
};

// Greenhouse floor plan. `rows` is an array of rows, each an array of
// cells {key, label, tag, onClick?}. Cells pop in row by row so the map
// visibly "fills in" when a report opens.
export function GreenhouseMap({ rows, compact = false, showTags = !compact, entrance = true }) {
  const widest = Math.max(1, ...rows.map((r) => r.length));
  let n = 0;
  return (
    <div className={`gh-plan${compact ? " compact" : ""}`}>
      <div className="gh-rows" style={{ maxWidth: widest * (compact ? 62 : 86) + 22, margin: "0 auto" }}>
        {rows.map((row, i) => (
          <div className="gh-row" key={i}>
            <div className="gh-row-letter">{row[0]?.label?.replace(/\d+$/, "")}</div>
            <div className="gh-row-cells" style={{ gridTemplateColumns: `repeat(${widest}, minmax(0, 1fr))` }}>
              {row.map((cell) => {
                const meta = STATUS_META[cell.tag] || STATUS_META.unscanned;
                const Tag = cell.onClick ? "button" : "div";
                const delay = `${Math.min(n++ * 35, 700)}ms`;
                return (
                  <Tag
                    key={cell.key}
                    className={`gh-cell ${meta.fill}`}
                    style={{
                      animationDelay: delay,
                      boxShadow: cell.highlight ? "0 0 0 2px var(--bg-card), 0 0 0 4px var(--bad)" : undefined,
                    }}
                    onClick={cell.onClick}
                    aria-label={`${cell.label} — ${cell.tagLabel || meta.label}`}
                  >
                    <span className="label">{cell.label}</span>
                    {showTags && <span className="tag">{cell.tagLabel || meta.label}</span>}
                  </Tag>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {entrance && <div className="gh-entrance"><span>кіреберіс</span></div>}
    </div>
  );
}

export function MapLegend({ tags = ["ok", "warn", "bad", "unknown", "unscanned"] }) {
  return (
    <div className="gh-legend">
      {tags.map((t) => (
        <span key={t}><i className={STATUS_META[t].fill} />{STATUS_META[t].label}</span>
      ))}
    </div>
  );
}

// One bar split proportionally by status, with mono counts under it.
export function StatusRuler({ counts }) {
  const order = ["ok", "warn", "bad", "unknown", "unscanned"];
  const total = order.reduce((sum, k) => sum + (counts[k] || 0), 0) || 1;
  return (
    <div>
      <div className="ruler-bar">
        {order.map((k) => (counts[k] ? (
          <span key={k} style={{ flex: counts[k] / total, background: k === "unscanned" ? "transparent" : k === "unknown" ? "var(--unscanned-ink)" : STATUS_META[k].color, border: k === "unscanned" ? "1px dashed rgba(20,32,30,.25)" : 0 }} />
        ) : null))}
      </div>
      <div className="ruler-ticks" />
      <div className="ruler-counts">
        {order.filter((k) => !["unscanned", "unknown"].includes(k) || counts[k]).map((k) => (
          <div className="ruler-count" key={k}>
            <b style={{ color: STATUS_META[k].color }}>{counts[k] || 0}</b>
            <small>{STATUS_META[k].label}</small>
          </div>
        ))}
      </div>
    </div>
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
    unscanned: { cls: "badge-none", label: "Түсірілмеген" },
    unknown: { cls: "badge-none", label: "Анықталмады" },
  };
  const entry = map[severity] || map.ok;
  return <span className={`badge ${entry.cls}`}>{entry.label}</span>;
}

export function NumberedList({ items }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {items.map((text, i) => (
        <div className="numbered-item" key={i}>
          <div className="num">{String(i + 1).padStart(2, "0")}</div>
          <div style={{ font: "400 14px/1.55 var(--font)", color: "var(--ink-soft)" }}>{text}</div>
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

// A ruler-style 0–100 meter with tick marks — the plant's "health" as a
// reading on a scale, not a progress ring.
export function HealthMeter({ percent }) {
  const color = percent >= 80 ? "var(--accent)" : percent >= 60 ? "var(--warn)" : "var(--bad)";
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <span className="eyebrow">Денсаулық</span>
        <span style={{ font: "600 22px/1 var(--mono)", color }}>{percent}<small style={{ fontSize: 12, marginLeft: 1 }}>%</small></span>
      </div>
      <div style={{ position: "relative", height: 8, marginTop: 10, background: "#E4EAE7", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, width: `${percent}%`, background: color, transformOrigin: "left", animation: "zd-fill .9s cubic-bezier(.2,.7,.2,1) both" }} />
      </div>
      <div className="ruler-ticks" />
      <div style={{ display: "flex", justifyContent: "space-between", font: "400 9.5px var(--mono)", color: "var(--ink-faint)", marginTop: 3 }}>
        <span>0</span><span>50</span><span>100</span>
      </div>
    </div>
  );
}

function StatusStats({ narrative }) {
  const side = [
    narrative.humidity_level ? { label: "Ылғалдылық", value: capitalizeKk(narrative.humidity_level) } : null,
    narrative.sun_stress_level ? { label: "Күн стресі", value: capitalizeKk(narrative.sun_stress_level) } : null,
  ].filter(Boolean);
  if (!(narrative.health_percent > 0) && !side.length) return null;
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {narrative.health_percent > 0 && <HealthMeter percent={narrative.health_percent} />}
      {side.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${side.length}, 1fr)`, borderTop: "1px solid var(--ink-hairline)", paddingTop: 12 }}>
          {side.map((r, i) => (
            <div key={r.label} style={{ paddingLeft: i ? 14 : 0, borderLeft: i ? "1px solid var(--ink-hairline)" : 0 }}>
              <div className="eyebrow">{r.label}</div>
              <div style={{ font: "600 15px var(--font)", marginTop: 4 }}>{r.value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Renders the OpenAI vision diagnosis result (see backend
// apps/ml/openai_vision.py) as numbered journal sections — status
// readout, cause, treatment steps, prevention, and the closing
// encouragement as a serif pull-quote. `startNo` lets a screen continue
// its own section numbering. Returns null when there's no narrative.
export function AiNarrative({ narrative, startNo = 1 }) {
  if (!narrative) return null;
  const { disease_type, cause, treatment_steps, prevention_tips, encouragement } = narrative;
  let no = startNo;
  return (
    <>
      {disease_type && (
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span className="eyebrow">Ауру түрі</span>
          <span style={{ font: "600 13.5px var(--font)", color: "var(--bad-ink)" }}>{capitalizeKk(disease_type)}</span>
        </div>
      )}
      <StatusStats narrative={narrative} />
      {cause && (
        <>
          <SectionHead no={no++} title="Себебі" />
          <p style={{ margin: 0, font: "400 14px/1.65 var(--font)", color: "var(--ink-soft)" }}>{cause}</p>
        </>
      )}
      {treatment_steps?.length > 0 && (
        <>
          <SectionHead no={no++} title="Емдеу жолы" aside={`${treatment_steps.length} қадам`} />
          <NumberedList items={treatment_steps} />
        </>
      )}
      {prevention_tips?.length > 0 && (
        <>
          <SectionHead no={no++} title="Алдын алу" />
          <BulletList items={prevention_tips} />
        </>
      )}
      {encouragement && (
        <blockquote
          style={{
            margin: "6px 0 0", padding: "16px 18px", background: "var(--accent-tint)", borderRadius: "var(--radius-md)",
            borderLeft: "3px solid var(--accent)", font: "italic 500 16px/1.5 var(--font-display)", color: "var(--accent-hover)",
          }}
        >
          {encouragement}
        </blockquote>
      )}
    </>
  );
}

export function BulletList({ items }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
      {items.map((text, i) => (
        <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <span style={{ width: 10, height: 1.5, background: "var(--accent)", marginTop: 10, flex: "none" }} />
          <div style={{ font: "400 14px/1.55 var(--font)", color: "var(--ink-soft)" }}>{text}</div>
        </div>
      ))}
    </div>
  );
}
