import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { getAccessToken } from "../api/client";
import { useDevice, type Device } from "../api/devices";
import { useReboot, useRestartAsterisk } from "../api/system";
import { FlashBanner } from "../components/FlashBanner";
import { LiveDot } from "../components/LiveDot";
import { StatusPill } from "../components/StatusPill";

export function DeviceDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: device, isLoading, error } = useDevice(id!);
  const queryClient = useQueryClient();
  const [live, setLive] = useState(false);
  const [systemFlash, setSystemFlash] = useState<{ kind: "ok" | "error"; message: string } | null>(null);
  const restartAsterisk = useRestartAsterisk(id!);
  const reboot = useReboot(id!);

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

  const handleRestartAsterisk = async () => {
    if (!confirm(`Restart Asterisk on ${device?.name}? This briefly interrupts the repeater.`)) {
      return;
    }
    setSystemFlash(null);
    try {
      await restartAsterisk.mutateAsync();
      setSystemFlash({ kind: "ok", message: "Asterisk restarted." });
    } catch (err) {
      setSystemFlash({ kind: "error", message: err instanceof Error ? err.message : "restart failed" });
    }
  };

  const handleReboot = async () => {
    if (!confirm(`Reboot ${device?.name} now? Any active radio traffic and connections will drop, and it will take about a minute to come back.`)) {
      return;
    }
    setSystemFlash(null);
    try {
      await reboot.mutateAsync();
      setSystemFlash({ kind: "ok", message: "Rebooting now — this device will stop responding shortly." });
    } catch (err) {
      setSystemFlash({ kind: "error", message: err instanceof Error ? err.message : "reboot failed" });
    }
  };

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
        <h2>Restart options</h2>
        {systemFlash && <FlashBanner kind={systemFlash.kind} message={systemFlash.message} />}
        <div className="row">
          <div className="field" style={{ flex: "none" }}>
            <div className="label-row">
              <span className="muted">Restart just the radio software</span>
            </div>
            <button onClick={handleRestartAsterisk} disabled={restartAsterisk.isPending}>
              Restart radio software
            </button>
          </div>
          <div className="field" style={{ flex: "none" }}>
            <div className="label-row">
              <span className="muted">Restart the whole device</span>
            </div>
            <button className="danger" onClick={handleReboot} disabled={reboot.isPending}>
              Reboot device
            </button>
          </div>
        </div>
        <p className="hint" style={{ marginTop: "1rem" }}>
          Both require "Allow remote restart/reboot" to be turned on in this device's own Cloud Sync settings — otherwise these
          are refused.
        </p>
      </div>

      <div className="card">
        <div className="label-row">
          <h2 style={{ margin: 0 }}>Nodes reported by this device</h2>
        </div>
        {device.nodes.length === 0 && <p className="hint">None reported yet.</p>}
        {device.nodes.length > 0 && (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Last seen</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {device.nodes.map((n) => (
                  <tr key={n.number}>
                    <td className="tag">{n.number}</td>
                    <td>{new Date(n.lastSeenAt).toLocaleString()}</td>
                    <td>
                      <Link to={`/devices/${device.id}/nodes/${n.number}`}>Edit</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="actions">
          <Link to={`/devices/${device.id}/nodes`} className="btn">
            Manage nodes
          </Link>
        </div>
        <p className="hint" style={{ marginTop: "1rem" }}>
          Config editing currently covers the same fields as the local app's own Setup tab. AllStarLink network registration,
          command/tone sets, sounds, restart/reboot, and the rest follow in later phases.
        </p>
      </div>
    </div>
  );
}
