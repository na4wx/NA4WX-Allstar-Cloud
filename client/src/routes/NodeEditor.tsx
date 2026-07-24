import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { useNodeLive } from "../api/nodeLive";
import { useDeleteNode, useNode, useSaveNode, type Node } from "../api/nodes";
import { AllstarNetworkTab } from "../components/AllstarNetworkTab";
import { AutomationScheduleSection } from "../components/AutomationScheduleSection";
import { CommandSetSection } from "../components/CommandSetSection";
import { CourtesyToneSection } from "../components/CourtesyToneSection";
import { FlashBanner } from "../components/FlashBanner";
import { LiveCommandsTab } from "../components/LiveCommandsTab";
import { LiveDot } from "../components/LiveDot";
import { SkywarnSection } from "../components/SkywarnSection";
import { SoundScheduleSection } from "../components/SoundScheduleSection";
import { Tabs, TabPanel, type TabDef } from "../components/Tabs";
import { TelemetrySection } from "../components/TelemetrySection";
import { WXToneSection } from "../components/WXToneSection";

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

const tabs: TabDef[] = [
  { id: "setup", label: "Setup" },
  { id: "tones", label: "Tones & Audio" },
  { id: "allstar", label: "Allstar Network" },
  { id: "live", label: "Live & Commands" },
  { id: "scheduler", label: "Scheduler" },
  { id: "skywarn", label: "SkywarnPlus" },
];

export function NodeEditor() {
  const { deviceId, number } = useParams<{ deviceId: string; number: string }>();
  const { data: existing, isLoading, isError } = useNode(deviceId!, number!);
  const saveNode = useSaveNode(deviceId!);
  const deleteNode = useDeleteNode(deviceId!);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

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

  const activeTab = tabs.some((t) => t.id === searchParams.get("tab")) ? searchParams.get("tab")! : "setup";
  const setActiveTab = (id: string) => setSearchParams((prev) => { const next = new URLSearchParams(prev); next.set("tab", id); return next; }, { replace: true });

  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
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

      <div className="subnav">
        <div className="subnav-title">
          <h1>
            Node {number} {isNew && <span className="tag">new</span>}
          </h1>
        </div>
        <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />
      </div>

      {flash && <FlashBanner kind={flash.kind} message={flash.message} />}

      <TabPanel id="setup" active={activeTab}>
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

          <div className="card">
            <h2>Advanced</h2>
            <p className="hint">Section names this node uses in rpt.conf — leave blank to use the defaults.</p>
            <div className="row">
              <div className="field">
                <label htmlFor="telemetry">Telemetry section</label>
                <input id="telemetry" type="text" value={form.telemetry} onChange={set("telemetry")} placeholder="telemetry" />
              </div>
              <div className="field">
                <label htmlFor="morse">Morse section</label>
                <input id="morse" type="text" value={form.morse} onChange={set("morse")} placeholder={`morse${number ?? ""}`} />
              </div>
              <div className="field">
                <label htmlFor="functions">Functions section</label>
                <input id="functions" type="text" value={form.functions} onChange={set("functions")} placeholder="functions" />
              </div>
              <div className="field">
                <label htmlFor="macro">Macro section</label>
                <input id="macro" type="text" value={form.macro} onChange={set("macro")} placeholder="macro" />
              </div>
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
        {!isNew && <CommandSetSection deviceId={deviceId!} number={number!} />}
      </TabPanel>

      <TabPanel id="tones" active={activeTab}>
        {isNew ? (
          <p className="hint">Save this node first to manage its tones and audio.</p>
        ) : (
          <>
            <CourtesyToneSection deviceId={deviceId!} node={number!} />
            <TelemetrySection deviceId={deviceId!} node={number!} />
            <WXToneSection deviceId={deviceId!} node={number!} />
          </>
        )}
      </TabPanel>

      <TabPanel id="allstar" active={activeTab}>
        {isNew ? <p className="hint">Save this node first to manage its AllStarLink network registration.</p> : <AllstarNetworkTab deviceId={deviceId!} node={number!} />}
      </TabPanel>

      <TabPanel id="live" active={activeTab}>
        {isNew ? (
          <p className="hint">Save this node first to see its live status.</p>
        ) : (
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
        {!isNew && <LiveCommandsTab deviceId={deviceId!} node={number!} />}
      </TabPanel>

      <TabPanel id="scheduler" active={activeTab}>
        {isNew ? (
          <p className="hint">Save this node first to manage its schedules.</p>
        ) : (
          <>
            <AutomationScheduleSection deviceId={deviceId!} node={number!} />
            <SoundScheduleSection deviceId={deviceId!} node={number!} />
          </>
        )}
      </TabPanel>

      <TabPanel id="skywarn" active={activeTab}>
        {isNew ? <p className="hint">Save this node first to manage its SkywarnPlus settings.</p> : <SkywarnSection deviceId={deviceId!} node={number!} />}
      </TabPanel>
    </div>
  );
}
