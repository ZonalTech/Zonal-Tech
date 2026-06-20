import { Link } from "react-router-dom";
import { useAuth } from "../auth.jsx";

export default function Footer() {
  const { user } = useAuth();
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div>
          <div className="brand" style={{ marginBottom: ".6rem" }}>
            <img src="/logo.png" className="logo-img" alt="Zonal Tech" />
            <span className="brand-name"><span className="bn-z">Zonal</span>&nbsp;<span className="bn-t">Tech</span></span>
          </div>
          <small>Software & licensing for African businesses. Built on the Zone framework.</small>
        </div>
        <nav className="footer-links">
          <Link to="/services">Services</Link>
          <a href="/#pricing">Pricing</a>
          <Link to="/support">Support</Link>
          <Link to="/status">Status</Link>
          <Link to="/contact">Contact</Link>
          {user
            ? <Link to={user.role === "admin" ? "/admin" : "/dashboard"}>Dashboard</Link>
            : <Link to="/login">Sign in</Link>}
        </nav>
      </div>
      <div className="container" style={{ marginTop: "1.5rem", color: "var(--faint)", fontSize: ".85rem" }}>
        © {new Date().getFullYear()} Zonal Tech. All rights reserved.
      </div>
    </footer>
  );
}
