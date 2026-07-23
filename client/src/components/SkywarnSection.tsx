import { useState } from "react";

import { useSkywarnAddNode, useSkywarnCounties, useSkywarnSetCounties, useSkywarnStatus, useSkywarnToggle, type SkywarnStatus } from "../api/skywarn";
import { FlashBanner } from "./FlashBanner";

// key is the toggle's name as SkywarnPlus's own SkyControl.py expects
// it; read is how to read that toggle's current value back off Status
// (whose own JSON/field names don't quite match SkyControl.py's key
// spelling -- e.g. "sayalert" vs. Status.SayAlert).
const toggleKeys: { key: string; label: string; read: (s: SkywarnStatus) => boolean }[] = [
  { key: "enable", label: "Weather alerts", read: (s) => s.enable },
  { key: "sayalert", label: "Announce new alerts", read: (s) => s.sayAlert },
  { key: "sayallclear", label: "Announce all-clear", read: (s) => s.sayAllClear },
];

// SkywarnSection surfaces SkywarnPlus's own toggles and county-code
// subscription for one node -- see internal/skywarnplus's package doc.
// AlertScript, Pushover, and SkyDescribe settings aren't in this UI yet.
export function SkywarnSection({ deviceId, node }: { deviceId: string; node: string }) {
  const { data: status, isLoading, error } = useSkywarnStatus(deviceId);
  const { data: counties } = useSkywarnCounties(deviceId);
  const toggle = useSkywarnToggle(deviceId);
  const setCounties = useSkywarnSetCounties(deviceId);
  const addNode = useSkywarnAddNode(deviceId);
  const [countyToAdd, setCountyToAdd] = useState("");
  const [flash, setFlash] = useState<{ kind: "ok" | "error"; message: string } | null>(null);

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
        </>
      )}
    </div>
  );
}
