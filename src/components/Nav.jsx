import { useState } from "react";
import { NavLink, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";

export default function Nav() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const close = () => setOpen(false);

  const isAdmin = user?.role === "admin";
  const initials = user
    ? (user.name || user.email).split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase()
    : "";

  // Admins get a focused management nav — no customer-facing marketing links.
  const brandTo = isAdmin ? "/admin" : "/";

  return (
    <header className={`nav ${open ? "nav-open" : ""}`}>
      <div className="container nav-inner">
        <Link to={brandTo} className="brand" onClick={close}>
          <img src="/logo.png" className="logo-img" alt="Zonal Tech" />
          <span className="brand-name"><span className="bn-z">Zonal</span>&nbsp;<span className="bn-t">Tech</span></span>
        </Link>

        <nav className="nav-links">
          {isAdmin ? (
            <>
              <NavLink to="/admin" end onClick={close}>Dashboard</NavLink>
              <NavLink to="/admin/users" onClick={close}>Users</NavLink>
              <NavLink to="/admin/services" onClick={close}>Services</NavLink>
              <NavLink to="/admin/payments" onClick={close}>Payments</NavLink>
              <NavLink to="/admin/settings" onClick={close}>AI</NavLink>
            </>
          ) : (
            <>
              <NavLink to="/" end onClick={close}>Home</NavLink>
              <NavLink to="/services" onClick={close}>Services</NavLink>
              <NavLink to="/hardware" onClick={close}>Hardware</NavLink>
              <NavLink to="/cloud" onClick={close}>Cloud</NavLink>
              <NavLink to="/studio" onClick={close}>Studio</NavLink>
              <a href="/#pricing" onClick={close}>Pricing</a>
              <NavLink to="/support" onClick={close}>Support</NavLink>
              <NavLink to="/status" onClick={close}>Status</NavLink>
              <NavLink to="/contact" onClick={close}>Contact</NavLink>
            </>
          )}
        </nav>

        <div className="spacer" />

        <div className="nav-cta">
          {user ? (
            <>
              {!isAdmin && <Link to="/dashboard" className="btn btn-ghost btn-sm" onClick={close}>Dashboard</Link>}
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
