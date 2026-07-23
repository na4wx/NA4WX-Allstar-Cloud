import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { getAccessToken } from "../api/client";
import { useDevice, type Device } from "../api/devices";
import { LiveDot } from "../components/LiveDot";
import { StatusPill } from "../components/StatusPill";

export function DeviceDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: device, isLoading, error } = useDevice(id!);
  const queryClient = useQueryClient();
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!id) {
      return;
    }
    // EventSource can't set an Authorization header, so the access
    // token rides along as a query param here -- see requireAuth's own
    // doc comment on the server for why that's an accepted, narrow
    // exception rather than the general auth pattern.
    const token = getAccessToken();
    const url = `/api/devices/${id}/live${token ? `?token=${encodeURIComponent(token)}` : ""}`;
    const source = new EventSource(url);

    source.addEventListener("open", () => setLive(true));
    source.addEventListener("error", () => setLive(false));
    source.addEventListener("status", (event) => {
      const data = JSON.parse((event as MessageEvent).data) as Device;
      queryClient.setQueryData(["devices", id], data);
    });

    return () => source.close();
  }, [id, queryClient]);

  if (isLoading) {
    return <p className="hint">Loading…</p>;
  }
  if (error || !device) {
    return <div className="flash error">{error instanceof Error ? error.message : "Device not found"}</div>;
  }

  return (
    <div>
      <p>
        <Link to="/">&larr; All devices</Link>
      </p>
      <div className="label-row">
        <h1 style={{ marginBottom: 0 }}>{device.name}</h1>
      </div>

      <div className="card">
        <div className="live-head">
          <h2 style={{ margin: 0 }}>
            <LiveDot on={live} /> Connection
          </h2>
          <StatusPill status={device.status} />
        </div>
        <div className="stat-grid">
          <div className="stat">
            <div className="label">Last seen</div>
            <div className="value">{device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString() : "never"}</div>
          </div>
          <div className="stat">
            <div className="label">API key</div>
            <div className="value">…{device.apiKeyHint}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Asterisk status</h2>
        {!device.lastStatus && <p className="hint">No status received yet — waiting for this device to connect.</p>}
        {device.lastStatus && (
          <table className="stats-table">
            <tbody>
              <tr>
                <th scope="row">Asterisk running</th>
                <td>{device.lastStatus.asterisk_running ? "Yes" : "No"}</td>
              </tr>
              <tr>
                <th scope="row">Uptime</th>
                <td>{device.lastStatus.uptime || "—"}</td>
              </tr>
              <tr>
                <th scope="row">Hostname</th>
                <td>{device.lastStatus.hostname || "—"}</td>
              </tr>
              {device.lastStatus.error && (
                <tr>
                  <th scope="row">Note</th>
                  <td>{device.lastStatus.error}</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>Nodes reported by this device</h2>
        {device.nodes.length === 0 && <p className="hint">None reported yet.</p>}
        {device.nodes.length > 0 && (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Last seen</th>
                </tr>
              </thead>
              <tbody>
                {device.nodes.map((n) => (
                  <tr key={n.number}>
                    <td className="tag">{n.number}</td>
                    <td>{new Date(n.lastSeenAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="hint" style={{ marginTop: "1rem" }}>
          Config editing, restart/reboot, and the rest of the local app's features are managed remotely in a later phase — this
          page currently shows read-only connectivity status.
        </p>
      </div>
    </div>
  );
}
