import { useState, type FormEvent } from "react";

import { useSendDTMF } from "../api/nodes";
import { useDeviceRole } from "../state/deviceRole";
import { FlashBanner } from "./FlashBanner";
import { FunctionMacroTable } from "./FunctionMacroTable";

const FUNCTION_REFERENCE_ID = "function_reference";

// functionReference is a pure static copy of node_form.html's own
// "Function reference" table -- no backend, ported directly.
const functionReference: { command: string; description: string }[] = [
  { command: "ilink,1", description: "Disconnect the most recently connected node" },
  { command: "ilink,2", description: "Connect to a node, listen-only — you can hear them, they can't hear you" },
  { command: "ilink,3", description: "Connect to a node, both directions — stays connected until manually disconnected" },
  { command: "ilink,5", description: "Announce which nodes are currently connected" },
  { command: "ilink,6", description: "Disconnect every connected node at once" },
  { command: "ilink,8", description: "Connect to a node, listen-only, temporary — drops automatically when the repeater goes idle" },
  { command: "status,1", description: "Announce this node's own number and status" },
  { command: "autopatchup", description: "Start an autopatch call (dial out through a connected phone line/gateway, if one is set up)" },
  { command: "autopatchdn", description: "End the current autopatch call" },
  { command: "cop,<n>", description: "\"Control operator\" — local system actions like reloading configuration. Which number does what depends on your setup; see the documentation." },
  { command: "macro,<n>", description: "Runs a saved sequence of commands in one dial — macros are defined elsewhere in rpt.conf" },
];

// LiveCommandsTab covers node_form.html's own "Live & Commands" tab:
// sending a touch-tone sequence right now, the command list ("functions"
// section), saved macros ("macro" section), and a static function
// reference table.
export function LiveCommandsTab({ deviceId, node }: { deviceId: string; node: string }) {
  const sendDTMF = useSendDTMF(deviceId, node);
  const { canEdit } = useDeviceRole();
  const [digits, setDigits] = useState("");
  const [flash, setFlash] = useState<{ kind: "ok" | "error"; message: string } | null>(null);

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    setFlash(null);
    if (!confirm(`Send this command to node ${node} now? This can connect or disconnect live links.`)) {
      return;
    }
    try {
      const result = await sendDTMF.mutateAsync(digits);
      setFlash({ kind: "ok", message: result.output ? `Sent ${digits}: ${result.output}` : `Sent ${digits}.` });
      setDigits("");
    } catch (err) {
      setFlash({ kind: "error", message: err instanceof Error ? err.message : "send failed" });
    }
  };

  return (
    <>
      <div className="card">
        <h2>Send a touch-tone command now</h2>
        <p className="hint">Sends the sequence below exactly as if it were dialed on the radio itself.</p>
        {flash && <FlashBanner kind={flash.kind} message={flash.message} />}
        <form onSubmit={handleSend}>
          <div className="row">
            <div className="field">
              <label htmlFor="dtmf_digits">Touch-tone sequence</label>
              <input id="dtmf_digits" type="text" value={digits} onChange={(e) => setDigits(e.target.value)} placeholder="*32000" required />
            </div>
          </div>
          <div className="actions">
            <button type="submit" className="primary" disabled={sendDTMF.isPending || !canEdit}>
              Send
            </button>
          </div>
        </form>
      </div>

      <FunctionMacroTable
        deviceId={deviceId}
        node={node}
        kind="functions"
        title="Command list"
        digitsLabel="Digits to dial"
        digitsPlaceholder="1"
        commandLabel="Command"
        commandPlaceholder="ilink,3"
        commandListId={FUNCTION_REFERENCE_ID}
      />

      <FunctionMacroTable
        deviceId={deviceId}
        node={node}
        kind="macro"
        title="Saved macros"
        digitsLabel="Macro number"
        digitsPlaceholder="1"
        commandLabel="Sequence it runs"
        commandPlaceholder="*12000*32001"
      />

      <div className="card">
        <h2>Function reference</h2>
        <p className="hint">The building blocks you can type into the Command field above.</p>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Command</th>
                <th>What it does</th>
              </tr>
            </thead>
            <tbody>
              {functionReference.map((f) => (
                <tr key={f.command}>
                  <td>{f.command}</td>
                  <td>{f.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <datalist id={FUNCTION_REFERENCE_ID}>
        {functionReference.map((f) => (
          <option key={f.command} value={f.command} />
        ))}
      </datalist>
    </>
  );
}
