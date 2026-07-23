import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../state/auth";

// Port of the local Go app's header.topbar -- a flat brand + nav row,
// no sidebar, matching that app's layout language (see
// web/templates/layout.html).
export function TopNav() {
  const { email, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <header className="topbar">
      <Link to="/" className="brand">
        NA4WX Allstar Cloud
      </Link>
      {email && (
        <nav>
          <span className="muted" style={{ marginRight: "0.75rem" }}>
            {email}
          </span>
          <button onClick={handleLogout}>Log out</button>
        </nav>
      )}
    </header>
  );
}
