import { useState } from "react";
import { Feedback } from "../components/Feedback";

export default function LoginPage({ onLogin, role }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await onLogin(email, password, role);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={`login-shell ${role === "ADMIN" ? "admin-login" : "sales-login"}`}>
      <section className="login-card">
        <p className="eyebrow">{role === "ADMIN" ? "ADMIN PORTAL" : "SALES PORTAL"}</p>
        <h1>{role === "ADMIN" ? "Admin workspace" : "Sales workflow"}</h1>
        <p className="muted">
          {role === "ADMIN"
            ? "Sign in to oversee inventory, orders, and dispatch operations."
            : "Sign in to manage customer enquiries, quotations, and sales orders."}
        </p>
        <form className="stack" onSubmit={submit}>
          <label>
            Email
            <input
              autoComplete="username"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label>
            Password
            <input
              autoComplete="current-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          <Feedback error={error} />
          <button disabled={busy} type="submit">{busy ? "Signing in..." : "Sign in"}</button>
        </form>
        <p className="portal-switch">
          {role === "ADMIN" ? "Looking for the sales workspace?" : "Are you an administrator?"}{" "}
          <a href={role === "ADMIN" ? "/sales/login" : "/admin/login"}>
            {role === "ADMIN" ? "Sales sign in" : "Admin sign in"}
          </a>
        </p>
      </section>
    </main>
  );
}
