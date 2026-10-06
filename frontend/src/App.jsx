import { useEffect, useState } from "react";
import { useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import EnquiriesPage from "./pages/EnquiriesPage";
import QuotationsPage from "./pages/QuotationsPage";
import SalesOrdersPage from "./pages/SalesOrdersPage";
import InventoryPage from "./pages/InventoryPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import SalesDashboardPage from "./pages/SalesDashboardPage";

const salesSections = [
  { id: "overview", label: "Dashboard" },
  { id: "enquiries", label: "Enquiries" },
  { id: "quotations", label: "Quotations" },
  { id: "orders", label: "Sales Orders" },
  { id: "inventory", label: "Inventory" }
];

const adminSections = [
  { id: "overview", label: "Overview" },
  { id: "inventory", label: "Inventory" },
  { id: "orders", label: "Sales Orders" },
  { id: "dispatch", label: "Dispatch" }
];

export default function App() {
  const { user, login, logout } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [section, setSection] = useState("overview");
  const portalRole = window.location.pathname.startsWith("/admin") ? "ADMIN" : "SALES_USER";
  const loginRole = portalRole === "ADMIN" ? "ADMIN" : "SALES_USER";
  const expectedPath = isAdmin ? "/admin/dashboard" : "/sales/dashboard";
  const isLoginPath = window.location.pathname.endsWith("/login") || window.location.pathname === "/";

  useEffect(() => {
    if (user && (isLoginPath || (isAdmin ? portalRole !== "ADMIN" : portalRole !== "SALES_USER"))) {
      window.history.replaceState({}, "", expectedPath);
    }
  }, [expectedPath, isAdmin, isLoginPath, portalRole, user]);

  useEffect(() => {
    const portalTitle = user
      ? user.role === "ADMIN" ? "Admin Dashboard" : "Sales Dashboard"
      : loginRole === "ADMIN" ? "Admin Portal" : "Sales Portal";
    document.title = `Industrial ERP | ${portalTitle}`;
  }, [loginRole, user]);

  const sections = isAdmin ? adminSections : salesSections;
  const activeSection = sections.some((item) => item.id === section)
    ? section
    : "overview";

  useEffect(() => {
    setSection("overview");
  }, [isAdmin]);

  if (!user) return <LoginPage onLogin={login} role={loginRole} />;

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setSection("overview"); }}>
          <span className="brand-mark">IE</span>
          <span><strong>Industrial ERP</strong><small>{isAdmin ? "Admin workspace" : "Sales workflow"}</small></span>
        </a>
        <nav aria-label="Main navigation">
          {sections.map((item) => (
            <button
              aria-current={activeSection === item.id ? "page" : undefined}
              className={`nav-button ${activeSection === item.id ? "active" : ""}`}
              key={item.id}
              onClick={() => setSection(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="user-menu">
          <span><strong>{user.email}</strong><small>{user.role.replace("_", " ")}</small></span>
          <button className="secondary button-small" onClick={logout}>Log out</button>
        </div>
      </header>
      <main className="content">
        <div className="page-title">
          <div><p className="eyebrow">{isAdmin ? "ADMIN OPERATIONS" : "OPERATIONS"}</p><h1>{sections.find((item) => item.id === activeSection).label}</h1></div>
        </div>
        {isAdmin && activeSection === "overview" && <AdminDashboardPage />}
        {!isAdmin && activeSection === "overview" && <SalesDashboardPage />}
        {!isAdmin && activeSection === "enquiries" && <EnquiriesPage />}
        {!isAdmin && activeSection === "quotations" && <QuotationsPage />}
        {activeSection === "orders" && <SalesOrdersPage view="orders" />}
        {isAdmin && activeSection === "dispatch" && <SalesOrdersPage view="dispatch" />}
        {activeSection === "inventory" && <InventoryPage />}
      </main>
    </div>
  );
}
