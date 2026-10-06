import { useState } from "react";
import { Feedback } from "../components/Feedback";

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await onLogin(email, password);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <p className="eyebrow">INDUSTRIAL ERP</p>
        <h1>Sales workflow</h1>
        <p className="muted">Sign in to manage enquiries, quotations, and orders.</p>
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
        <p className="login-hint">Development demo: admin@example.com / Admin@123</p>
      </section>
    </main>
  );
}
