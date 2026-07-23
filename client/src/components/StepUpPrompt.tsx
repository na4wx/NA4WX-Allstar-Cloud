import { useEffect, useRef, useState, type FormEvent } from "react";

import { apiFetch } from "../api/client";
import { StepUpCancelledError, registerStepUpHandler } from "../api/stepUp";

interface Pending {
  resolve: (token: string) => void;
  reject: (err: Error) => void;
}

// StepUpPrompt is mounted once, at the app root (see App.tsx) --
// api/stepUp.ts's ensureStepUp() calls into it (via
// registerStepUpHandler) whenever a gated action needs a token and
// none is currently cached, so no individual page needs its own copy
// of this modal.
export function StepUpPrompt() {
  const [visible, setVisible] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const pendingRef = useRef<Pending | null>(null);

  useEffect(() => {
    registerStepUpHandler(() => {
      return new Promise<string>((resolve, reject) => {
        pendingRef.current = { resolve, reject };
        setPassword("");
        setError(null);
        setVisible(true);
      });
    });
  }, []);

  const close = () => {
    setVisible(false);
    pendingRef.current = null;
  };

  const handleCancel = () => {
    pendingRef.current?.reject(new StepUpCancelledError());
    close();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const data = await apiFetch<{ stepUpToken: string }>("/api/auth/step-up", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      pendingRef.current?.resolve(data.stepUpToken);
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "incorrect password");
    } finally {
      setSubmitting(false);
    }
  };

  if (!visible) {
    return null;
  }

  return (
    <div className="modal-backdrop" onClick={handleCancel}>
      <div className="modal card" onClick={(e) => e.stopPropagation()}>
        <h2>Confirm your password</h2>
        <p className="hint">This action is sensitive enough to re-check your password before continuing.</p>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="step_up_password">Password</label>
            <input
              id="step_up_password"
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <div className="flash error">{error}</div>}
          <div className="actions">
            <button type="button" onClick={handleCancel} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="primary" disabled={submitting || !password}>
              Confirm
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
