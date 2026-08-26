import { useNavigate, useLocation } from "react-router-dom";

const TABS = [
  { key: "dash", path: "/app", icon: "home", label: "Басты" },
  { key: "scan", path: "/app/scan", icon: "scan", label: "Шолу" },
  { key: "tips", path: "/app/tips", icon: "bulb", label: "Кеңестер" },
  { key: "profile", path: "/app/profile", icon: "profile", label: "Профиль" },
];

// Small hand-drawn line icons matching the app's shell — 2px stroke,
// rounded joins, currentColor (so .tab-btn/.tab-btn.active's color
// already handles the idle/active teal switch with no extra logic, same
// as the plain-shape placeholders they replace).
const ICON_PROPS = {
  width: 22, height: 22, viewBox: "0 0 24 24", fill: "none",
  stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round",
};

function HomeIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9a1 1 0 0 0 1 1h3v-6h4v6h3a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}

function ScanIcon() {
  // Viewfinder corners around a dot — echoes the app's QR-scan screens.
  return (
    <svg {...ICON_PROPS}>
      <path d="M4 9V6.5A2.5 2.5 0 0 1 6.5 4H9" />
      <path d="M15 4h2.5A2.5 2.5 0 0 1 20 6.5V9" />
      <path d="M20 15v2.5a2.5 2.5 0 0 1-2.5 2.5H15" />
      <path d="M9 20H6.5A2.5 2.5 0 0 1 4 17.5V15" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

function BulbIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M12 3a6.5 6.5 0 0 0-3.7 11.8c.55.4.7 1 .7 1.7v.5h6v-.5c0-.7.15-1.3.7-1.7A6.5 6.5 0 0 0 12 3z" />
      <path d="M9.5 20h5" />
      <path d="M10.3 22h3.4" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.5 20c.7-4 4-6 7.5-6s6.8 2 7.5 6" />
    </svg>
  );
}

const ICONS = { home: HomeIcon, scan: ScanIcon, bulb: BulbIcon, profile: ProfileIcon };

function TabIcon({ name }) {
  const Icon = ICONS[name] || HomeIcon;
  return <Icon />;
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
          <TabIcon name={tab.icon} />
          <span className="tab-label">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
