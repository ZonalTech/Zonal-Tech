import { useState } from "react";
import { NavLink, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";

export default function Nav() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const close = () => setOpen(false);

  const initials = user
    ? (user.name || user.email).split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase()
    : "";

  return (
    <header className={`nav ${open ? "nav-open" : ""}`}>
      <div className="container nav-inner">
        <Link to="/" className="brand" onClick={close}>
          <span className="logo">ZT</span> Zonal&nbsp;Tech
        </Link>

        <nav className="nav-links">
          <NavLink to="/" end onClick={close}>Home</NavLink>
          <NavLink to="/services" onClick={close}>Services</NavLink>
          <a href="/#pricing" onClick={close}>Pricing</a>
          {user?.role === "admin" && <NavLink to="/admin" onClick={close}>Admin</NavLink>}
        </nav>

        <div className="spacer" />

        <div className="nav-cta">
          {user ? (
            <>
              <Link to="/dashboard" className="btn btn-ghost btn-sm" onClick={close}>Dashboard</Link>
              <button className="btn btn-sm" onClick={() => { logout(); close(); navigate("/"); }}>
                Sign out
              </button>
              <div className="avatar" title={user.email}>{initials}</div>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm" onClick={close}>Sign in</Link>
              <Link to="/register" className="btn btn-primary btn-sm" onClick={close}>Get started</Link>
            </>
          )}
        </div>

        <button className="nav-toggle" onClick={() => setOpen((o) => !o)} aria-label="Menu">
          {open ? "✕" : "☰"}
        </button>
      </div>
    </header>
  );
}
