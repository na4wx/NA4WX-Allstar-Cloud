import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../state/auth";

export function ForgotPassword() {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // The server returns the same generic message whether or not the
      // email matches an account -- shown verbatim, never worked around
      // on this side (that would defeat the point).
      const serverMessage = await forgotPassword(email);
      setMessage(serverMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="card">
        <h1>Forgot password</h1>
        {error && <div className="flash error">{error}</div>}
        {message ? (
          <div className="flash ok">{message}</div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </div>
            <div className="actions">
              <button type="submit" className="primary" disabled={submitting}>
                Send reset link
              </button>
            </div>
          </form>
        )}
        <p className="hint">
          <Link to="/login">Back to log in</Link>
        </p>
      </div>
    </div>
  );
}
