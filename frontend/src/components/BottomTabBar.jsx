import { useNavigate, useLocation } from "react-router-dom";

const TABS = [
  { key: "dash", path: "/app", icon: "square", label: "Басты" },
  { key: "scan", path: "/app/scan", icon: "circle", label: "Шолу" },
  { key: "tips", path: "/app/tips", icon: "rect", label: "Кеңестер" },
  { key: "profile", path: "/app/profile", icon: "circle", label: "Профиль" },
];

function TabIcon({ shape }) {
  if (shape === "rect") return <span className="tab-icon-rect" />;
  if (shape === "circle") return <span className="tab-icon-circle" />;
  return <span className="tab-icon-square" />;
}

export default function BottomTabBar() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="tabbar">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          className={`tab-btn${location.pathname === tab.path ? " active" : ""}`}
          onClick={() => navigate(tab.path)}
        >
          <TabIcon shape={tab.icon} />
          <span className="tab-label">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
