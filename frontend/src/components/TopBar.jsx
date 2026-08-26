import { useNavigate } from "react-router-dom";

export function BackButton({ to, onClick, dark = false, label = "‹" }) {
  const navigate = useNavigate();
  return (
    <button
      className={`icon-btn${dark ? " on-dark" : ""}`}
      onClick={onClick || (() => (to ? navigate(to) : navigate(-1)))}
      aria-label="Артқа"
    >
      {label}
    </button>
  );
}

export function TopBar({ title, subtitle, to, onBack, dark = false }) {
  return (
    <div className="topbar">
      <BackButton to={to} onClick={onBack} dark={dark} />
      <div>
        {subtitle && <div className="step-label">{subtitle}</div>}
        <div className="title-md">{title}</div>
      </div>
    </div>
  );
}
