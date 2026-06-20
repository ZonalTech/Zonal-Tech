import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div>
          <div className="brand" style={{ marginBottom: ".6rem" }}>
            <span className="logo">ZT</span> Zonal&nbsp;Tech
          </div>
          <small>Software & licensing for African businesses. Built on the Zone framework.</small>
        </div>
        <nav className="footer-links">
          <Link to="/services">Services</Link>
          <a href="/#pricing">Pricing</a>
          <Link to="/login">Sign in</Link>
          <a href="mailto:support@zonaltech.co.ke">support@zonaltech.co.ke</a>
        </nav>
      </div>
      <div className="container" style={{ marginTop: "1.5rem", color: "var(--faint)", fontSize: ".85rem" }}>
        © {new Date().getFullYear()} Zonal Tech. All rights reserved.
      </div>
    </footer>
  );
}
