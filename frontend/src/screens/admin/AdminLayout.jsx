import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/useAuthStore";

// The separate admin area the plan calls for: staff upload/label leaf
// photos, trigger retraining, and activate model versions here — kept
// out of the phone-frame shell since it's a desktop dataset-management
// tool, not part of the farmer/home-user app.
export default function AdminLayout() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);

  return (
    <div className="admin-shell">
      <div className="admin-nav">
        <div className="brand">ZhasylDala · Админ</div>
        <NavLink to="/admin" end>Деректер жиыны</NavLink>
        <NavLink to="/admin/jobs">Оқыту тапсырмалары</NavLink>
        <NavLink to="/admin/models">Модель нұсқалары</NavLink>
        <div className="spacer" />
        <span style={{ font: "500 13px var(--font)", color: "var(--ink-mute)", marginRight: 12 }}>{user?.full_name}</span>
        <button
          className="admin-btn"
          style={{ background: "transparent", color: "var(--bad)", border: "1px solid rgba(20,32,30,.14)" }}
          onClick={() => {
            logout();
            navigate("/welcome");
          }}
        >
          Шығу
        </button>
      </div>
      <div className="admin-body">
        <Outlet />
      </div>
    </div>
  );
}
