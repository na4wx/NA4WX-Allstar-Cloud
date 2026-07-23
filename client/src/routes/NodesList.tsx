import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useDevice } from "../api/devices";
import { useNodes } from "../api/nodes";

export function NodesList() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const { data: device } = useDevice(deviceId!);
  const { data: numbers, isLoading, error } = useNodes(deviceId!);
  const navigate = useNavigate();
  const [newNumber, setNewNumber] = useState("");

  const handleAdd = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = newNumber.trim();
    if (!/^[0-9]+$/.test(trimmed)) {
      return;
    }
    navigate(`/devices/${deviceId}/nodes/${trimmed}`);
  };

  return (
    <div>
      <p>
        <Link to={`/devices/${deviceId}`}>&larr; {device?.name ?? "Device"}</Link>
      </p>
      <h1>Nodes</h1>

      <div className="card">
        <h2>Add a node</h2>
        <form onSubmit={handleAdd}>
          <div className="row">
            <div className="field">
              <label htmlFor="new_number">Node number</label>
              <input
                id="new_number"
                type="text"
                pattern="[0-9]+"
                value={newNumber}
                onChange={(e) => setNewNumber(e.target.value)}
                placeholder="e.g. 546051"
                required
              />
              <div className="hint">The number assigned when you registered this node at allstarlink.org.</div>
            </div>
          </div>
          <div className="actions">
            <button type="submit" className="primary">
              Continue
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2>Existing nodes</h2>
        {isLoading && <p className="hint">Loading…</p>}
        {error && <div className="flash error">{(error as Error).message}</div>}
        {numbers && numbers.length === 0 && <p className="hint">No nodes configured on this device yet.</p>}
        {numbers && numbers.length > 0 && (
          <div className="row">
            {numbers.map((n) => (
              <Link key={n} to={`/devices/${deviceId}/nodes/${n}`} className="tag" style={{ fontSize: "0.95rem" }}>
                {n}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
