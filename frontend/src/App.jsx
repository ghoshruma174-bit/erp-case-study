import { useState } from "react";
import { useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import EnquiriesPage from "./pages/EnquiriesPage";
import QuotationsPage from "./pages/QuotationsPage";
import SalesOrdersPage from "./pages/SalesOrdersPage";
import InventoryPage from "./pages/InventoryPage";

const sections = [
  { id: "enquiries", label: "Enquiries" },
  { id: "quotations", label: "Quotations" },
  { id: "orders", label: "Sales Orders" },
  { id: "inventory", label: "Inventory" }
];

export default function App() {
  const { user, login, logout } = useAuth();
  const [section, setSection] = useState("enquiries");

  if (!user) return <LoginPage onLogin={login} />;

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setSection("enquiries"); }}>
          <span className="brand-mark">IE</span>
          <span><strong>Industrial ERP</strong><small>Sales workflow</small></span>
        </a>
        <nav aria-label="Main navigation">
          {sections.map((item) => (
            <button
              aria-current={section === item.id ? "page" : undefined}
              className={`nav-button ${section === item.id ? "active" : ""}`}
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
          <div><p className="eyebrow">OPERATIONS</p><h1>{sections.find((item) => item.id === section).label}</h1></div>
        </div>
        {section === "enquiries" && <EnquiriesPage />}
        {section === "quotations" && <QuotationsPage />}
        {section === "orders" && <SalesOrdersPage />}
        {section === "inventory" && <InventoryPage />}
      </main>
    </div>
  );
}
