import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { useAuth } from "../state/auth";

export function ResetPassword() {
  const { resetPassword } = useAuth();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setSubmitting(true);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "reset failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="card">
        <h1>Reset password</h1>
        {!token && <div className="flash error">This reset link is missing its token — check the link from your email.</div>}
        {error && <div className="flash error">{error}</div>}
        {done ? (
          <div className="flash ok">Password reset. You can log in with your new password now.</div>
        ) : (
          token && (
            <form onSubmit={handleSubmit}>
              <div className="field">
                <label htmlFor="password">New password</label>
                <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoFocus />
                <div className="hint">At least 8 characters.</div>
              </div>
              <div className="field">
                <label htmlFor="confirm">Confirm new password</label>
                <input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} />
              </div>
              <div className="actions">
                <button type="submit" className="primary" disabled={submitting}>
                  Reset password
                </button>
              </div>
            </form>
          )
        )}
        <p className="hint">
          <Link to="/login">{done ? "Log in" : "Back to log in"}</Link>
        </p>
      </div>
    </div>
  );
}
