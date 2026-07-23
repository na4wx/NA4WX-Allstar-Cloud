import { useEffect, useState, type FormEvent } from "react";

import {
  useSkywarnAddNode,
  useSkywarnCounties,
  useSkywarnSetCounties,
  useSkywarnSetPushover,
  useSkywarnSetSkyDescribe,
  useSkywarnStatus,
  useSkywarnToggle,
  type PushoverStatus,
  type SkyDescribeStatus,
  type SkywarnStatus,
} from "../api/skywarn";
import { FlashBanner } from "./FlashBanner";

// key is the toggle's name as SkywarnPlus's own SkyControl.py expects
// it; read is how to read that toggle's current value back off Status
// (whose own JSON/field names don't quite match SkyControl.py's key
// spelling -- e.g. "sayalert" vs. Status.SayAlert).
const toggleKeys: { key: string; label: string; read: (s: SkywarnStatus) => boolean }[] = [
  { key: "enable", label: "Weather alerts", read: (s) => s.enable },
  { key: "sayalert", label: "Announce new alerts", read: (s) => s.sayAlert },
  { key: "sayallclear", label: "Announce all-clear", read: (s) => s.sayAllClear },
  { key: "tailmessage", label: "Alert tailmessage", read: (s) => s.tailmessage },
  { key: "alertscript", label: "Run AlertScript on new alerts", read: (s) => s.alertScript },
];

const blankPushover: PushoverStatus = { enable: false, userKey: "", apiToken: "", debug: false };
const blankSkyDescribe: SkyDescribeStatus = { apiKey: "", language: "", speed: 0, voice: "", maxWords: 0 };

// SkywarnSection surfaces SkywarnPlus's own toggles, county-code
// subscription, Pushover notifications, and SkyDescribe (VoiceRSS
// detailed-alert-description) settings for one node -- see
// internal/skywarnplus's package doc.
export function SkywarnSection({ deviceId, node }: { deviceId: string; node: string }) {
  const { data: status, isLoading, error } = useSkywarnStatus(deviceId);
  const { data: counties } = useSkywarnCounties(deviceId);
  const toggle = useSkywarnToggle(deviceId);
  const setCounties = useSkywarnSetCounties(deviceId);
  const addNode = useSkywarnAddNode(deviceId);
  const setPushover = useSkywarnSetPushover(deviceId);
  const setSkyDescribe = useSkywarnSetSkyDescribe(deviceId);
  const [countyToAdd, setCountyToAdd] = useState("");
  const [flash, setFlash] = useState<{ kind: "ok" | "error"; message: string } | null>(null);

  const [pushoverForm, setPushoverForm] = useState<PushoverStatus>(blankPushover);
  const [skyDescribeForm, setSkyDescribeForm] = useState<SkyDescribeStatus>(blankSkyDescribe);

  useEffect(() => {
    if (status) {
      setPushoverForm(status.pushover);
      setSkyDescribeForm(status.skyDescribe);
    }
  }, [status]);

  const isRegistered = status?.nodes.includes(node) ?? false;

  const handleToggle = async (key: string, value: boolean) => {
    setFlash(null);
    try {
      await toggle.mutateAsync({ key, value });
    } catch (err) {
      setFlash({ kind: "error", message: err instanceof Error ? err.message : "toggle failed" });
    }
  };

  const handleRegisterNode = async () => {
    setFlash(null);
    try {
      await addNode.mutateAsync(node);
      setFlash({ kind: "ok", message: `Node ${node} registered with SkywarnPlus.` });
    } catch (err) {
      setFlash({ kind: "error", message: err instanceof Error ? err.message : "failed" });
    }
  };

  const handleAddCounty = async () => {
    if (!countyToAdd || !status) {
      return;
    }
    setFlash(null);
    try {
      await setCounties.mutateAsync([...status.countyCodes, countyToAdd]);
      setCountyToAdd("");
    } catch (err) {
      setFlash({ kind: "error", message: err instanceof Error ? err.message : "failed" });
    }
  };

  const handleRemoveCounty = async (code: string) => {
    if (!status) {
      return;
    }
    setFlash(null);
    try {
      await setCounties.mutateAsync(status.countyCodes.filter((c) => c !== code));
    } catch (err) {
      setFlash({ kind: "error", message: err instanceof Error ? err.message : "failed" });
    }
  };

  const handleSavePushover = async (e: FormEvent) => {
    e.preventDefault();
    setFlash(null);
    try {
      await setPushover.mutateAsync(pushoverForm);
      setFlash({ kind: "ok", message: "Pushover settings saved." });
    } catch (err) {
      setFlash({ kind: "error", message: err instanceof Error ? err.message : "failed" });
    }
  };

  const handleSaveSkyDescribe = async (e: FormEvent) => {
    e.preventDefault();
    setFlash(null);
    try {
      await setSkyDescribe.mutateAsync(skyDescribeForm);
      setFlash({ kind: "ok", message: "SkyDescribe settings saved." });
    } catch (err) {
      setFlash({ kind: "error", message: err instanceof Error ? err.message : "failed" });
    }
  };

  return (
    <div className="card">
      <h2>SkywarnPlus (weather alerts)</h2>
      {isLoading && <p className="hint">Loading…</p>}
      {error && (
        <p className="hint">
          Not installed on this device — re-run install.sh on the Pi and choose to install SkywarnPlus, then reload this page.
        </p>
      )}
      {flash && <FlashBanner kind={flash.kind} message={flash.message} />}

      {status && (
        <>
          <div className="row">
            {toggleKeys.map((t) => (
              <div className="field" key={t.key} style={{ flex: "none" }}>
                <label>{t.label}</label>
                <select value={String(t.read(status))} onChange={(e) => handleToggle(t.key, e.target.value === "true")}>
                  <option value="true">On</option>
                  <option value="false">Off</option>
                </select>
              </div>
            ))}
          </div>

          {!isRegistered && (
            <p className="hint">
              This node isn't registered with SkywarnPlus yet.{" "}
              <button onClick={handleRegisterNode} disabled={addNode.isPending}>
                Register node {node}
              </button>
            </p>
          )}

          <div className="field" style={{ marginTop: "1rem" }}>
            <label>Subscribed counties</label>
            <div className="row">
              {status.countyCodes.length === 0 && <span className="hint">None yet.</span>}
              {status.countyCodes.map((code) => (
                <span key={code} className="tag">
                  {code}{" "}
                  <button onClick={() => handleRemoveCounty(code)} style={{ marginLeft: "0.3rem", padding: "0 0.3rem" }}>
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label htmlFor="county_add">Add a county</label>
              <input id="county_add" list="county_options" value={countyToAdd} onChange={(e) => setCountyToAdd(e.target.value)} placeholder="Search by name or code" />
              <datalist id="county_options">
                {counties?.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </datalist>
            </div>
            <div className="field" style={{ flex: "none", alignSelf: "flex-end" }}>
              <button onClick={handleAddCounty} disabled={setCounties.isPending}>
                Add
              </button>
            </div>
          </div>

          <h3 style={{ marginTop: "1.5rem" }}>Pushover notifications</h3>
          <form onSubmit={handleSavePushover}>
            <div className="row">
              <div className="field" style={{ flex: "none" }}>
                <label htmlFor="pushover_enable">Enable</label>
                <select
                  id="pushover_enable"
                  value={String(pushoverForm.enable)}
                  onChange={(e) => setPushoverForm((f) => ({ ...f, enable: e.target.value === "true" }))}
                >
                  <option value="true">On</option>
                  <option value="false">Off</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="pushover_user_key">User key</label>
                <input id="pushover_user_key" type="text" value={pushoverForm.userKey} onChange={(e) => setPushoverForm((f) => ({ ...f, userKey: e.target.value }))} />
              </div>
              <div className="field">
                <label htmlFor="pushover_api_token">API token</label>
                <input id="pushover_api_token" type="text" value={pushoverForm.apiToken} onChange={(e) => setPushoverForm((f) => ({ ...f, apiToken: e.target.value }))} />
              </div>
              <div className="field" style={{ flex: "none" }}>
                <label htmlFor="pushover_debug">Debug</label>
                <select
                  id="pushover_debug"
                  value={String(pushoverForm.debug)}
                  onChange={(e) => setPushoverForm((f) => ({ ...f, debug: e.target.value === "true" }))}
                >
                  <option value="true">On</option>
                  <option value="false">Off</option>
                </select>
              </div>
            </div>
            <div className="actions">
              <button type="submit" disabled={setPushover.isPending}>
                Save Pushover settings
              </button>
            </div>
          </form>

          <h3 style={{ marginTop: "1.5rem" }}>SkyDescribe (detailed alert descriptions)</h3>
          <form onSubmit={handleSaveSkyDescribe}>
            <div className="row">
              <div className="field">
                <label htmlFor="skydescribe_api_key">VoiceRSS API key</label>
                <input id="skydescribe_api_key" type="text" value={skyDescribeForm.apiKey} onChange={(e) => setSkyDescribeForm((f) => ({ ...f, apiKey: e.target.value }))} />
              </div>
              <div className="field">
                <label htmlFor="skydescribe_language">Language</label>
                <input
                  id="skydescribe_language"
                  type="text"
                  value={skyDescribeForm.language}
                  onChange={(e) => setSkyDescribeForm((f) => ({ ...f, language: e.target.value }))}
                  placeholder="e.g. en-us"
                />
              </div>
              <div className="field">
                <label htmlFor="skydescribe_voice">Voice</label>
                <input id="skydescribe_voice" type="text" value={skyDescribeForm.voice} onChange={(e) => setSkyDescribeForm((f) => ({ ...f, voice: e.target.value }))} />
              </div>
              <div className="field">
                <label htmlFor="skydescribe_speed">Speed</label>
                <input
                  id="skydescribe_speed"
                  type="number"
                  value={skyDescribeForm.speed}
                  onChange={(e) => setSkyDescribeForm((f) => ({ ...f, speed: Number(e.target.value) }))}
                />
              </div>
              <div className="field">
                <label htmlFor="skydescribe_max_words">Max words</label>
                <input
                  id="skydescribe_max_words"
                  type="number"
                  value={skyDescribeForm.maxWords}
                  onChange={(e) => setSkyDescribeForm((f) => ({ ...f, maxWords: Number(e.target.value) }))}
                />
              </div>
            </div>
            <div className="actions">
              <button type="submit" disabled={setSkyDescribe.isPending}>
                Save SkyDescribe settings
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
