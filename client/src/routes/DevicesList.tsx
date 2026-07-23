import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { useCreateDevice, useDeleteDevice, useDevices, type DeviceWithKey } from "../api/devices";
import { StepUpCancelledError, ensureStepUp } from "../api/stepUp";
import { StatusPill } from "../components/StatusPill";

export function DevicesList() {
  const { data: devices, isLoading, error } = useDevices();
  const createDevice = useCreateDevice();
  const deleteDevice = useDeleteDevice();
  const [name, setName] = useState("");
  const [justCreated, setJustCreated] = useState<DeviceWithKey | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    const device = await createDevice.mutateAsync(name);
    setJustCreated(device);
    setName("");
  };

  const handleDelete = async (id: string, deviceName: string) => {
    if (!confirm(`Remove "${deviceName}"? Its API key will stop working immediately.`)) {
      return;
    }
    setListError(null);
    try {
      const stepUpToken = await ensureStepUp();
      await deleteDevice.mutateAsync({ id, stepUpToken });
    } catch (err) {
      if (err instanceof StepUpCancelledError) {
        return;
      }
      setListError(err instanceof Error ? err.message : "remove failed");
    }
  };

  return (
    <div>
      <h1>Your devices</h1>

      {justCreated && (
        <div className="card" style={{ borderColor: "var(--accent)" }}>
          <h2>"{justCreated.name}" created</h2>
          <p>
            Copy this API key now — it won't be shown again. Paste it into <strong>{justCreated.name}</strong>'s own Cloud Sync
            settings card (System page) on the node itself.
          </p>
          <pre className="raw-block" style={{ userSelect: "all" }}>
            {justCreated.apiKey}
          </pre>
          <div className="actions">
            <button onClick={() => setJustCreated(null)}>Done</button>
          </div>
        </div>
      )}

      <div className="card">
        <h2>Add a device</h2>
        <form onSubmit={handleCreate}>
          <div className="row">
            <div className="field">
              <label htmlFor="device_name">Name</label>
              <input id="device_name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Home repeater" required />
            </div>
          </div>
          <div className="actions">
            <button type="submit" className="primary" disabled={createDevice.isPending}>
              Create device &amp; API key
            </button>
          </div>
          {createDevice.isError && <div className="flash error">{(createDevice.error as Error).message}</div>}
        </form>
      </div>

      <div className="card">
        <h2>Devices</h2>
        {isLoading && <p className="hint">Loading…</p>}
        {error && <div className="flash error">{(error as Error).message}</div>}
        {listError && <div className="flash error">{listError}</div>}
        {devices && devices.length === 0 && <p className="hint">No devices yet — add one above.</p>}
        {devices && devices.length > 0 && (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Nodes</th>
                  <th>Key</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {devices.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <Link to={`/devices/${d.id}`}>{d.name}</Link>
                    </td>
                    <td>
                      <StatusPill status={d.status} />
                      {!d.enabled && <span className="tag" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>revoked</span>}
                    </td>
                    <td>{d.nodes.length ? d.nodes.map((n) => <span key={n.number} className="tag">{n.number}</span>) : <span className="muted">none reported</span>}</td>
                    <td className="muted">…{d.apiKeyHint}</td>
                    <td>
                      <button className="danger" onClick={() => handleDelete(d.id, d.name)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
