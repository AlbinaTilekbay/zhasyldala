import { useNavigate } from "react-router-dom";

function Chevron() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.5 4.5 7 10l5.5 5.5" />
    </svg>
  );
}

export function BackButton({ to, onClick, dark = false, label }) {
  const navigate = useNavigate();
  return (
    <button
      className={`icon-btn${dark ? " on-dark" : ""}`}
      onClick={onClick || (() => (to ? navigate(to) : navigate(-1)))}
      aria-label="Артқа"
    >
      {label || <Chevron />}
    </button>
  );
}

export function TopBar({ title, subtitle, to, onBack, dark = false, right = null }) {
  return (
    <div className="topbar">
      <BackButton to={to} onClick={onBack} dark={dark} />
      <div className="topbar-text" style={{ flex: 1 }}>
        {subtitle && <div className="step-label">{subtitle}</div>}
        {title && <div className="title-md">{title}</div>}
      </div>
      {right}
    </div>
  );
}
