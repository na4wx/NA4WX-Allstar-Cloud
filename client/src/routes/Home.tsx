import { useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../state/auth";

// install.sh lives in the separate HamVoipConfigGui repo, not here --
// linked directly from GitHub raw rather than mirrored into this repo,
// so it can never go stale.
const INSTALL_SCRIPT_URL = "https://raw.githubusercontent.com/na4wx/na4wx_allstar_dashboard/main/install.sh";
const REPO_URL = "https://github.com/na4wx/na4wx_allstar_dashboard";
const INSTALL_COMMAND = `curl -fsSL ${INSTALL_SCRIPT_URL} | bash`;

// Home is the public page at "/" -- shown to everyone, logged in or
// not (see App.tsx: unlike every other route, this one isn't wrapped
// in RequireAuth). The CTA row adapts once auth state resolves, so a
// logged-in visitor gets a way back into the app instead of being
// stuck looking at "Log in" / "Create account".
export function Home() {
  const { email, loading } = useAuth();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(INSTALL_COMMAND);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <div className="card">
        <h1>NA4WX Allstar Cloud</h1>
        <p>
          A public, multi-tenant companion to the local HamVoipConfigGui dashboard your AllStar node already runs. Register a
          device here, drop its API key into that node's own &ldquo;Cloud Sync&rdquo; settings card, and manage it from
          anywhere. The node always dials <em>out</em> to this service — never the reverse — so nothing needs a public IP or
          port forwarding.
        </p>
        {!loading && (
          <div className="actions">
            {email ? (
              <Link to="/dashboard" className="btn primary">
                Go to your dashboard
              </Link>
            ) : (
              <>
                <Link to="/register" className="btn primary">
                  Create an account
                </Link>
                <Link to="/login" className="btn">
                  Log in
                </Link>
              </>
            )}
          </div>
        )}
      </div>

      <div className="card">
        <h2>What you can do remotely</h2>
        <ul>
          <li>Full node config — radio hardware, timing, identity, tones, AllStarLink registration, commands/macros, and scheduling</li>
          <li>Upload, preview, and play back sound files — or generate new ones from text with free, offline text-to-speech</li>
          <li>SkywarnPlus weather alerts, WX courtesy tones, and SA818 radio programming</li>
          <li>Capability-gated remote restart/reboot and raw config editing, with step-up password re-checks on the riskiest actions</li>
          <li>On-demand live node status, and an independent audit trail on both sides</li>
        </ul>
      </div>

      <div className="card">
        <h2>Get your node talking to this service</h2>
        <p className="hint">Run this on the Pi (or other host) running HamVoipConfigGui:</p>
        <div className="code-block">
          <code>{INSTALL_COMMAND}</code>
          <button type="button" onClick={handleCopy}>
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <p className="hint">
          Prefer to read it first rather than piping straight into bash? <a href={INSTALL_SCRIPT_URL}>View install.sh</a> ·{" "}
          <a href={REPO_URL}>Browse the source on GitHub</a>
        </p>
      </div>
    </div>
  );
}
