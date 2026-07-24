import { useState, type FormEvent } from "react";

import { useCloneOrApplyCommandSet, useNodes, useNormalizeNodeConfig, standardCommandSetSentinel } from "../api/nodes";
import { useDeviceRole } from "../state/deviceRole";
import { FlashBanner } from "./FlashBanner";

// CommandSetSection gives a node (including one created before this app
// knew how to give a new node a working command set) a complete
// functions/macro/telemetry/morse set -- either copied from another
// node or bootstrapped from known-good defaults -- and a "repair
// section names" action for a node whose sections are named for a
// different node entirely. Matches node_form.html's own "Command/tone
// set" card.
export function CommandSetSection({ deviceId, number }: { deviceId: string; number: string }) {
  const { data: nodes } = useNodes(deviceId);
  const cloneOrApply = useCloneOrApplyCommandSet(deviceId, number);
  const normalize = useNormalizeNodeConfig(deviceId, number);
  const { canEdit } = useDeviceRole();
  const [from, setFrom] = useState("");
  const [flash, setFlash] = useState<{ kind: "ok" | "error"; message: string } | null>(null);

  const otherNodes = (nodes ?? []).filter((n) => n !== number);

  const handleApply = async (e: FormEvent) => {
    e.preventDefault();
    setFlash(null);
    if (!from) {
      setFlash({ kind: "error", message: "Pick a command/tone set source" });
      return;
    }
    try {
      await cloneOrApply.mutateAsync(from);
      setFlash({ kind: "ok", message: "Command/tone set applied." });
    } catch (err) {
      setFlash({ kind: "error", message: err instanceof Error ? err.message : "failed" });
    }
  };

  const handleNormalize = async () => {
    setFlash(null);
    try {
      const result = await normalize.mutateAsync();
      setFlash({
        kind: "ok",
        message:
          result.changed.length === 0
            ? `Node ${number} already owns correctly-named command/tone sections — nothing needed repair.`
            : `Repaired node ${number}: ${result.changed.join(", ")} now use sections named for this node.`,
      });
    } catch (err) {
      setFlash({ kind: "error", message: err instanceof Error ? err.message : "failed" });
    }
  };

  return (
    <div className="card">
      <h2>Command/tone set</h2>
      <p className="hint">
        Give this node a complete functions/macro/telemetry/morse set — copied from another node, or bootstrapped from
        known-good defaults. Safe to re-run.
      </p>
      {flash && <FlashBanner kind={flash.kind} message={flash.message} />}
      <form onSubmit={handleApply}>
        <div className="row">
          <div className="field">
            <label htmlFor="command_set_from">Source</label>
            <select id="command_set_from" value={from} onChange={(e) => setFrom(e.target.value)}>
              <option value="">Choose a source</option>
              <option value={standardCommandSetSentinel}>Use standard defaults</option>
              {otherNodes.map((n) => (
                <option key={n} value={n}>
                  Copy from node {n}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="actions">
          <button type="submit" className="primary" disabled={cloneOrApply.isPending || !canEdit}>
            Apply
          </button>
        </div>
      </form>

      <p className="hint" style={{ marginTop: "1rem" }}>
        If this node's command/tone sections are named for a different node (e.g. created by renaming a template), repair
        them to use sections named for this node instead.
      </p>
      <div className="actions">
        <button type="button" onClick={handleNormalize} disabled={normalize.isPending || !canEdit}>
          Repair section names
        </button>
      </div>
    </div>
  );
}
