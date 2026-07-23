import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useProgramSA818, type SA818Settings } from "../api/sa818";
import { getAccessToken } from "../api/client";
import {
  useDeleteDevice,
  useDevice,
  useReactivateDevice,
  useRevokeDevice,
  useRotateDeviceKey,
  type Device,
  type DeviceWithKey,
} from "../api/devices";
import { useReboot, useRestartAsterisk } from "../api/system";
import { StepUpCancelledError, ensureStepUp } from "../api/stepUp";
import { FlashBanner } from "../components/FlashBanner";
import { LiveDot } from "../components/LiveDot";
import { StatusPill } from "../components/StatusPill";

const blankSA818: SA818Settings = {
  wide: true,
  txFreqMHz: "",
  rxFreqMHz: "",
  txCTCSS: "0000",
  rxCTCSS: "0000",
  squelch: 5,
  volume: 4,
  preDeEmphasis: false,
  highPassFilter: false,
  lowPassFilter: false,
};

export function DeviceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: device, isLoading, error } = useDevice(id!);
  const queryClient = useQueryClient();
  const [live, setLive] = useState(false);
  const [systemFlash, setSystemFlash] = useState<{ kind: "ok" | "error"; message: string } | null>(null);
  const restartAsterisk = useRestartAsterisk(id!);
  const reboot = useReboot(id!);
  const programSA818 = useProgramSA818(id!);
  const [sa818Form, setSA818Form] = useState<SA818Settings>(blankSA818);
  const [sa818Flash, setSA818Flash] = useState<{ kind: "ok" | "error"; message: string } | null>(null);
  const rotateKey = useRotateDeviceKey();
  const revokeDevice = useRevokeDevice();
  const reactivateDevice = useReactivateDevice();
  const deleteDevice = useDeleteDevice();
  const [securityFlash, setSecurityFlash] = useState<{ kind: "ok" | "error"; message: string } | null>(null);
  const [rotatedKey, setRotatedKey] = useState<DeviceWithKey | null>(null);

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
      const stepUpToken = await ensureStepUp();
      await restartAsterisk.mutateAsync(stepUpToken);
      setSystemFlash({ kind: "ok", message: "Asterisk restarted." });
    } catch (err) {
      if (err instanceof StepUpCancelledError) {
        return;
      }
      setSystemFlash({ kind: "error", message: err instanceof Error ? err.message : "restart failed" });
    }
  };

  const handleReboot = async () => {
    if (!confirm(`Reboot ${device?.name} now? Any active radio traffic and connections will drop, and it will take about a minute to come back.`)) {
      return;
    }
    setSystemFlash(null);
    try {
      const stepUpToken = await ensureStepUp();
      await reboot.mutateAsync(stepUpToken);
      setSystemFlash({ kind: "ok", message: "Rebooting now — this device will stop responding shortly." });
    } catch (err) {
      if (err instanceof StepUpCancelledError) {
        return;
      }
      setSystemFlash({ kind: "error", message: err instanceof Error ? err.message : "reboot failed" });
    }
  };

  const handleRotateKey = async () => {
    if (!confirm(`Rotate the API key for ${device?.name}? The old key stops working immediately, and this device will disconnect until it's given the new one.`)) {
      return;
    }
    setSecurityFlash(null);
    try {
      const stepUpToken = await ensureStepUp();
      const result = await rotateKey.mutateAsync({ id: id!, stepUpToken });
      setRotatedKey(result);
    } catch (err) {
      if (err instanceof StepUpCancelledError) {
        return;
      }
      setSecurityFlash({ kind: "error", message: err instanceof Error ? err.message : "key rotation failed" });
    }
  };

  const handleRevoke = async () => {
    if (!confirm(`Revoke ${device?.name}? It will disconnect immediately and won't be able to reconnect until reactivated or given a new key.`)) {
      return;
    }
    setSecurityFlash(null);
    try {
      const stepUpToken = await ensureStepUp();
      await revokeDevice.mutateAsync({ id: id!, stepUpToken });
      setSecurityFlash({ kind: "ok", message: "Device revoked — it can no longer connect." });
    } catch (err) {
      if (err instanceof StepUpCancelledError) {
        return;
      }
      setSecurityFlash({ kind: "error", message: err instanceof Error ? err.message : "revoke failed" });
    }
  };

  const handleReactivate = async () => {
    setSecurityFlash(null);
    try {
      await reactivateDevice.mutateAsync(id!);
      setSecurityFlash({ kind: "ok", message: "Device reactivated — it can connect again with its existing key." });
    } catch (err) {
      setSecurityFlash({ kind: "error", message: err instanceof Error ? err.message : "reactivate failed" });
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Remove "${device?.name}"? Its API key will stop working immediately, and this can't be undone.`)) {
      return;
    }
    setSecurityFlash(null);
    try {
      const stepUpToken = await ensureStepUp();
      await deleteDevice.mutateAsync({ id: id!, stepUpToken });
      navigate("/");
    } catch (err) {
      if (err instanceof StepUpCancelledError) {
        return;
      }
      setSecurityFlash({ kind: "error", message: err instanceof Error ? err.message : "remove failed" });
    }
  };

  const handleProgramSA818 = async () => {
    setSA818Flash(null);
    try {
      const result = await programSA818.mutateAsync(sa818Form);
      setSA818Flash(
        result.ok
          ? { kind: "ok", message: "Sent to the radio module." }
          : { kind: "error", message: "The radio module rejected these settings — see raw output below." },
      );
    } catch (err) {
      setSA818Flash({ kind: "error", message: err instanceof Error ? err.message : "programming failed" });
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
        {!device.enabled && <div className="flash error" style={{ marginTop: "1.25rem", marginBottom: 0 }}>This device is revoked and cannot connect.</div>}
      </div>

      <div className="card">
        <h2>Security</h2>
        {rotatedKey && (
          <div className="card" style={{ borderColor: "var(--accent)", marginBottom: "1.25rem" }}>
            <h2>New API key generated</h2>
            <p>
              Copy this now — it won't be shown again. Paste it into <strong>{rotatedKey.name}</strong>'s own Cloud Sync
              settings card (System page) on the node itself; the old key no longer works.
            </p>
            <pre className="raw-block" style={{ userSelect: "all" }}>
              {rotatedKey.apiKey}
            </pre>
            <div className="actions">
              <button onClick={() => setRotatedKey(null)}>Done</button>
            </div>
          </div>
        )}
        {securityFlash && <FlashBanner kind={securityFlash.kind} message={securityFlash.message} />}
        <div className="row">
          <div className="field" style={{ flex: "none" }}>
            <div className="label-row">
              <span className="muted">Issue a new key; the old one stops working immediately</span>
            </div>
            <button onClick={handleRotateKey} disabled={rotateKey.isPending}>
              Rotate API key
            </button>
          </div>
          {device.enabled ? (
            <div className="field" style={{ flex: "none" }}>
              <div className="label-row">
                <span className="muted">Disconnect and block reconnection, without deleting anything</span>
              </div>
              <button className="danger" onClick={handleRevoke} disabled={revokeDevice.isPending}>
                Revoke device
              </button>
            </div>
          ) : (
            <div className="field" style={{ flex: "none" }}>
              <div className="label-row">
                <span className="muted">Allow this device to reconnect with its existing key</span>
              </div>
              <button onClick={handleReactivate} disabled={reactivateDevice.isPending}>
                Reactivate device
              </button>
            </div>
          )}
          <div className="field" style={{ flex: "none" }}>
            <div className="label-row">
              <span className="muted">Permanently remove this device</span>
            </div>
            <button className="danger" onClick={handleDelete} disabled={deleteDevice.isPending}>
              Delete device
            </button>
          </div>
        </div>
        <p className="hint" style={{ marginTop: "1rem" }}>
          These all require re-entering your password.
        </p>
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
        <h2>Radio module (SA818/DRA818)</h2>
        <p className="hint">
          Programs the SHARI USB's radio module directly over its serial connection. Write-only — there's nothing to read back
          from the hardware, only a record of what was last sent.
        </p>
        {sa818Flash && <FlashBanner kind={sa818Flash.kind} message={sa818Flash.message} />}
        <div className="row">
          <div className="field">
            <label htmlFor="sa818_tx">Transmit frequency (MHz)</label>
            <input
              id="sa818_tx"
              type="text"
              value={sa818Form.txFreqMHz}
              onChange={(e) => setSA818Form((f) => ({ ...f, txFreqMHz: e.target.value }))}
              placeholder="446.1000"
            />
          </div>
          <div className="field">
            <label htmlFor="sa818_rx">Receive frequency (MHz)</label>
            <input
              id="sa818_rx"
              type="text"
              value={sa818Form.rxFreqMHz}
              onChange={(e) => setSA818Form((f) => ({ ...f, rxFreqMHz: e.target.value }))}
              placeholder="Same as transmit if left blank"
            />
          </div>
        </div>
        <div className="row">
          <div className="field">
            <label htmlFor="sa818_txctcss">Transmit CTCSS (0000 = none)</label>
            <input
              id="sa818_txctcss"
              type="text"
              value={sa818Form.txCTCSS}
              onChange={(e) => setSA818Form((f) => ({ ...f, txCTCSS: e.target.value }))}
            />
          </div>
          <div className="field">
            <label htmlFor="sa818_rxctcss">Receive CTCSS (0000 = none)</label>
            <input
              id="sa818_rxctcss"
              type="text"
              value={sa818Form.rxCTCSS}
              onChange={(e) => setSA818Form((f) => ({ ...f, rxCTCSS: e.target.value }))}
            />
          </div>
          <div className="field">
            <label htmlFor="sa818_squelch">Squelch (1-9)</label>
            <input
              id="sa818_squelch"
              type="number"
              min={1}
              max={9}
              value={sa818Form.squelch}
              onChange={(e) => setSA818Form((f) => ({ ...f, squelch: Number(e.target.value) }))}
            />
          </div>
          <div className="field">
            <label htmlFor="sa818_volume">Volume (0-8)</label>
            <input
              id="sa818_volume"
              type="number"
              min={0}
              max={8}
              value={sa818Form.volume}
              onChange={(e) => setSA818Form((f) => ({ ...f, volume: Number(e.target.value) }))}
            />
          </div>
        </div>
        <div className="actions">
          <button className="primary" onClick={handleProgramSA818} disabled={programSA818.isPending}>
            Program module
          </button>
        </div>
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
          <Link to={`/devices/${device.id}/sounds`} className="btn">
            Manage sounds
          </Link>
          <Link to={`/devices/${device.id}/rawconfig`} className="btn danger">
            Raw config
          </Link>
        </div>
        <p className="hint" style={{ marginTop: "1rem" }}>
          Node config editing covers the same fields as the local app's own Setup tab. Each node's own WX courtesy tones,
          sound schedule, and SkywarnPlus settings are on its own edit page. AllStarLink network registration and command/tone
          sets are not yet editable here.
        </p>
      </div>
    </div>
  );
}
