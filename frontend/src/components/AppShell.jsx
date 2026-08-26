// The "always looks like the mobile app" frame — see plan section
// "'Always mobile app' presentation". Every screen renders inside this.
export default function AppShell({ dark = false, tabs = null, children }) {
  return (
    <div className="app-backdrop">
      <div className={`app-shell${dark ? " is-dark" : ""}`}>
        <div className="screen-scroll">{children}</div>
        {tabs}
      </div>
    </div>
  );
}
