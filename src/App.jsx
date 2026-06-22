import { useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./auth.jsx";
import Nav from "./components/Nav.jsx";
import Footer from "./components/Footer.jsx";
import Home from "./pages/Home.jsx";
import Services from "./pages/Services.jsx";
import ServiceDetail from "./pages/ServiceDetail.jsx";
import Cloud from "./pages/Cloud.jsx";
import Hardware from "./pages/Hardware.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Checkout from "./pages/Checkout.jsx";
import Admin from "./pages/Admin.jsx";
import Generator from "./pages/Generator.jsx";
import GraphicsStudio from "./pages/GraphicsStudio.jsx";
import AdminSettings from "./pages/AdminSettings.jsx";
import AdminPayments from "./pages/AdminPayments.jsx";
import AdminServices from "./pages/AdminServices.jsx";
import AdminUsers from "./pages/AdminUsers.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import ChangePassword from "./pages/ChangePassword.jsx";
import Contact from "./pages/Contact.jsx";
import Support from "./pages/Support.jsx";
import Status from "./pages/Status.jsx";
import ChatWidget from "./components/ChatWidget.jsx";
import "./App.css";

function Protected({ children, admin }) {
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <div className="loading-page"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  // Users on an admin-issued temporary password must set their own first.
  if (user.must_change_password) return <Navigate to="/change-password" replace state={{ from: loc.pathname }} />;
  if (admin && user.role !== "admin") return <Navigate to="/dashboard" replace />;
  return children;
}

// The change-password page is reachable by any logged-in user, but unlike the
// other authenticated routes it does NOT bounce users who still owe a change —
// that's the one place they're allowed to go.
function RequireAuth({ children }) {
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <div className="loading-page"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return children;
}

// Auth pages (login/register/forgot) are for signed-out visitors only — once
// logged in, redirect to the dashboard (or admin) instead of showing them.
function GuestOnly({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <div className="loading-page"><div className="spinner" /></div>;
  if (user) return <Navigate to={user.role === "admin" ? "/admin" : "/dashboard"} replace />;
  return children;
}

export default function App() {
  const location = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  // Seamless route changes: jump to top without a scroll animation, and fade
  // the incoming page in (the keyed wrapper re-triggers the CSS animation).
  useEffect(() => {
    if (!location.hash) window.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname]);

  return (
    <div className="app-shell">
      <Nav />
      <main className="app-main">
        <div className="page-fade" key={location.pathname}>
        <Routes location={location}>
          <Route path="/" element={<Home />} />
          <Route path="/services" element={<Services />} />
          <Route path="/services/:key" element={<ServiceDetail />} />
          <Route path="/cloud" element={<Cloud />} />
          <Route path="/hardware" element={<Hardware />} />
          <Route path="/studio" element={<GraphicsStudio />} />
          <Route path="/support" element={<Support />} />
          <Route path="/status" element={<Status />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
          <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
          <Route path="/forgot-password" element={<GuestOnly><ForgotPassword /></GuestOnly>} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/change-password" element={<RequireAuth><ChangePassword /></RequireAuth>} />
          <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
          <Route path="/checkout/:planId" element={<Protected><Checkout /></Protected>} />
          <Route path="/admin" element={<Protected admin><Admin /></Protected>} />
          <Route path="/admin/generator" element={<Protected admin><Generator /></Protected>} />
          <Route path="/admin/settings" element={<Protected admin><AdminSettings /></Protected>} />
          <Route path="/admin/payments" element={<Protected admin><AdminPayments /></Protected>} />
          <Route path="/admin/services" element={<Protected admin><AdminServices /></Protected>} />
          <Route path="/admin/users" element={<Protected admin><AdminUsers /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </div>
      </main>
      {!isAdmin && <Footer />}
      {!isAdmin && <ChatWidget />}
    </div>
  );
}
