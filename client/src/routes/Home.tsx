import { useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../state/auth";

// install.sh lives in the separate HamVoipConfigGui repo, not here --
// linked directly from GitHub raw rather than mirrored into this repo,
// so it can never go stale.
const INSTALL_SCRIPT_URL = "https://raw.githubusercontent.com/na4wx/na4wx_allstar_dashboard/main/install.sh";
const REPO_URL = "https://github.com/na4wx/na4wx_allstar_dashboard";
const INSTALL_COMMAND = `curl -fsSL ${INSTALL_SCRIPT_URL} | bash`;

const features: { icon: string; title: string; description: string }[] = [
  {
    icon: "📡",
    title: "Full node configuration",
    description: "Radio hardware, timing, identity, tones, AllStarLink registration, DTMF commands and macros, and scheduling — the local dashboard's whole node editor, from anywhere.",
  },
  {
    icon: "🔊",
    title: "Sounds & text-to-speech",
    description: "Upload, preview, and play back sound files in the browser — or type text and generate natural-sounding audio with free, offline neural TTS, no API key needed.",
  },
  {
    icon: "🌩️",
    title: "Weather alerts",
    description: "SkywarnPlus configuration, county subscriptions, WX courtesy tone swaps, and Pushover notifications — keep severe-weather announcements working without SSH.",
  },
  {
    icon: "🔒",
    title: "Security first",
    description: "Risky actions are off by default and opt-in per node, with a password re-check on the most sensitive ones and an independent audit trail on both sides.",
  },
  {
    icon: "📈",
    title: "Live status",
    description: "See what your repeater is doing right now — connected nodes, who's keyed up, Asterisk health — streamed on demand, not polled around the clock.",
  },
  {
    icon: "🏠",
    title: "No port forwarding",
    description: "Your node always dials out to this service, never the reverse. It works from behind home NAT, CGNAT, or cellular — nothing needs a public IP.",
  },
];

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
      <div className="hero">
        <span className="hero-eyebrow">For AllStarLink node operators</span>
        <h1>
          Your AllStar node,
          <br />
          <span className="accent">managed from anywhere</span>
        </h1>
        <p className="hero-tagline">
          The cloud companion to the HamVoipConfigGui dashboard your node already runs. Register a device, paste one API key
          into its Cloud Sync settings, and manage it from any browser — no public IP, no port forwarding, no VPN.
        </p>
        {!loading && (
          <div className="hero-actions">
            {email ? (
              <Link to="/dashboard" className="btn primary">
                Go to your dashboard
              </Link>
            ) : (
              <>
                <Link to="/register" className="btn primary">
                  Create a free account
                </Link>
                <Link to="/login" className="btn">
                  Log in
                </Link>
              </>
            )}
          </div>
        )}
      </div>

      <div className="feature-grid">
        {features.map((f) => (
          <div key={f.title} className="feature-card">
            <span className="feature-icon">{f.icon}</span>
            <h3>{f.title}</h3>
            <p>{f.description}</p>
          </div>
        ))}
      </div>

      <div className="card">
        <h2 className="landing-section-title" style={{ marginTop: "0.5rem" }}>
          Up and running in three steps
        </h2>
        <div className="steps">
          <div className="step">
            <span className="step-num">1</span>
            <h3>Install on your node</h3>
            <p>One command on the Pi (or other host) sets up the local dashboard — or updates an existing install.</p>
          </div>
          <div className="step">
            <span className="step-num">2</span>
            <h3>Create an account here</h3>
            <p>Register your device to get an API key, and paste it into the node's own Cloud Sync settings card.</p>
          </div>
          <div className="step">
            <span className="step-num">3</span>
            <h3>Manage from anywhere</h3>
            <p>The node dials out and stays connected — every tab of its local dashboard, now in this one.</p>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Install on your node</h2>
        <p className="hint">Run this on the Pi (or other host) running HamVoIP:</p>
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
