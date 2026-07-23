import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useNodeLive } from "../api/nodeLive";
import { useDeleteNode, useNode, useSaveNode, type Node } from "../api/nodes";
import { FlashBanner } from "../components/FlashBanner";
import { LiveDot } from "../components/LiveDot";

type FormState = Omit<Node, "number">;

const blankForm: FormState = {
  dialString: "",
  rxChannel: "",
  txChannel: "",
  duplex: "",
  telemetry: "",
  morse: "",
  functions: "",
  macro: "",
  hangTime: "",
  altHangTime: "",
  toTime: "",
  idTime: "",
  idRecording: "",
  unlinkedCT: "",
  remoteCT: "",
  linkUnkeyCT: "",
  scheduler: "",
};

export function NodeEditor() {
  const { deviceId, number } = useParams<{ deviceId: string; number: string }>();
  const { data: existing, isLoading, isError } = useNode(deviceId!, number!);
  const saveNode = useSaveNode(deviceId!);
  const deleteNode = useDeleteNode(deviceId!);
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>(blankForm);
  const [flash, setFlash] = useState<{ kind: "ok" | "error"; message: string } | null>(null);

  // Sync local form state once the node loads -- a fresh (not-yet-created)
  // node simply never populates this, leaving the blank defaults, which
  // is what makes "add a node" and "edit a node" the same form.
  useEffect(() => {
    if (existing) {
      const { number: _number, ...rest } = existing;
      setForm(rest);
    }
  }, [existing]);

  const isNew = isError; // 404 from useNode means this number doesn't exist yet
  const { live, connected: liveConnected } = useNodeLive(deviceId!, number!);

  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFlash(null);
    try {
      await saveNode.mutateAsync({ number: number!, ...form });
      setFlash({ kind: "ok", message: `Node ${number} saved.` });
    } catch (err) {
      setFlash({ kind: "error", message: err instanceof Error ? err.message : "save failed" });
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete node ${number} from this device? This removes its rpt.conf section.`)) {
      return;
    }
    await deleteNode.mutateAsync(number!);
    navigate(`/devices/${deviceId}/nodes`);
  };

  if (isLoading) {
    return <p className="hint">Loading…</p>;
  }

  return (
    <div>
      <p>
        <Link to={`/devices/${deviceId}/nodes`}>&larr; Nodes</Link>
      </p>
      <h1>
        Node {number} {isNew && <span className="tag">new</span>}
      </h1>
      {flash && <FlashBanner kind={flash.kind} message={flash.message} />}

      {!isNew && (
        <div className="card">
          <div className="live-head">
            <h2 style={{ margin: 0 }}>
              <LiveDot on={liveConnected} /> Right now
            </h2>
            {live && <span className={`status-pill ${live.receiving ? "up" : ""}`}>{live.receiving ? "Receiving" : "Idle"}</span>}
          </div>
          {!live && <p className="hint">Waiting for the device to report this node's live state…</p>}
          {live && (
            <>
              {live.connected.length === 0 && <p className="hint">Not connected to any other node right now.</p>}
              {live.connected.length > 0 && (
                <div className="row">
                  {live.connected.map((c) => (
                    <span key={c.number} className="node-chip">
                      <span className="tag">{c.number}</span>
                      {c.callsign && <span className="node-call">{c.callsign}</span>}
                      {c.keyed && <span className="talking-badge">TX</span>}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="card">
          <h2>Radio hardware</h2>
          <div className="row">
            <div className="field">
              <label htmlFor="rxChannel">Radio device</label>
              <input id="rxChannel" type="text" value={form.rxChannel} onChange={set("rxChannel")} placeholder="e.g. SimpleUSB/usb" />
              <div className="hint">To create or adjust the device itself, use the device's own System page for now.</div>
            </div>
            <div className="field">
              <label htmlFor="txChannel">Transmit device (rarely needed)</label>
              <input id="txChannel" type="text" value={form.txChannel} onChange={set("txChannel")} placeholder="Leave blank unless you know you need this" />
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label htmlFor="duplex">Repeater mode</label>
              <select id="duplex" value={form.duplex} onChange={set("duplex")}>
                <option value="">(not set)</option>
                <option value="1">Full repeater — normal setup, with status tones</option>
                <option value="0">Simplex — one frequency, no status tones</option>
                <option value="4">Simplex — one frequency, with status tones</option>
                <option value="2">Full repeater — quieter (fewer status tones)</option>
                <option value="3">Full repeater — silent (no status tones at all)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="card">
          <h2>Timing</h2>
          <div className="row">
            <div className="field">
              <label htmlFor="hangTime">Squelch tail (ms)</label>
              <input id="hangTime" type="number" value={form.hangTime} onChange={set("hangTime")} placeholder="5000" />
            </div>
            <div className="field">
              <label htmlFor="altHangTime">Alternate squelch tail (ms)</label>
              <input id="altHangTime" type="number" value={form.altHangTime} onChange={set("altHangTime")} />
            </div>
            <div className="field">
              <label htmlFor="toTime">Transmit safety cutoff (ms)</label>
              <input id="toTime" type="number" value={form.toTime} onChange={set("toTime")} placeholder="180000" />
            </div>
            <div className="field">
              <label htmlFor="idTime">ID announcement interval (ms)</label>
              <input id="idTime" type="number" value={form.idTime} onChange={set("idTime")} placeholder="300000" />
            </div>
          </div>
        </div>

        <div className="card">
          <h2>Identity</h2>
          <div className="field">
            <label htmlFor="idRecording">Station ID announcement</label>
            <input id="idRecording" type="text" value={form.idRecording} onChange={set("idRecording")} placeholder="|iYOURCALLSIGN or a sound file name" />
          </div>
          <div className="field">
            <label htmlFor="dialString">Local connection address (rarely needed)</label>
            <input id="dialString" type="text" value={form.dialString} onChange={set("dialString")} placeholder="Leave blank unless you know you need this" />
          </div>
        </div>

        <div className="actions">
          <button type="submit" className="primary" disabled={saveNode.isPending}>
            Save
          </button>
          {!isNew && (
            <button type="button" className="danger" onClick={handleDelete} disabled={deleteNode.isPending}>
              Delete node
            </button>
          )}
        </div>
      </form>

      <p className="hint" style={{ marginTop: "1.5rem" }}>
        Command/tone sets, courtesy tones, AllStarLink network registration, sounds, and scheduling aren't editable here yet —
        this covers the same fields as the local app's own Setup tab; the rest follow in later phases.
      </p>
    </div>
  );
}
