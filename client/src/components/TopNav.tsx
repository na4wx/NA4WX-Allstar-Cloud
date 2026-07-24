import { Link, NavLink, useMatch, useNavigate } from "react-router-dom";

import { useAuth } from "../state/auth";

// Port of the local Go app's header.topbar -- a flat brand + nav row,
// no sidebar, matching that app's layout language (see
// web/templates/layout.html). Unlike the local app (which manages
// exactly one node and so has fixed nav entries: Home/Nodes/Status/
// System/Raw Config), this app is multi-device, so "Dashboard" is the
// one nav entry that's always present, plus a device's own sub-pages
// (Overview/Nodes/Sounds/Raw config) whenever the current route is
// scoped to a device -- giving lateral navigation between a device's
// pages without backtracking through its Overview page first.
export function TopNav() {
  const { email, logout } = useAuth();
  const navigate = useNavigate();
  const deviceMatch = useMatch("/devices/:deviceId/*");
  const deviceId = deviceMatch?.params.deviceId;

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) => (isActive ? "active" : undefined);

  return (
    <header className="topbar">
      <Link to={email ? "/dashboard" : "/"} className="brand">
        NA4WX Allstar Cloud
      </Link>
      {email && (
        <nav>
          <NavLink to="/dashboard" end className={navLinkClass}>
            Dashboard
          </NavLink>
          {deviceId && (
            <>
              <NavLink to={`/devices/${deviceId}`} end className={navLinkClass}>
                Overview
              </NavLink>
              <NavLink to={`/devices/${deviceId}/nodes`} className={navLinkClass}>
                Nodes
              </NavLink>
              <NavLink to={`/devices/${deviceId}/sounds`} className={navLinkClass}>
                Sounds
              </NavLink>
              <NavLink to={`/devices/${deviceId}/rawconfig`} className={navLinkClass}>
                Raw config
              </NavLink>
            </>
          )}
          <span className="muted" style={{ margin: "0 0.75rem" }}>
            {email}
          </span>
          <button onClick={handleLogout}>Log out</button>
        </nav>
      )}
    </header>
  );
}
