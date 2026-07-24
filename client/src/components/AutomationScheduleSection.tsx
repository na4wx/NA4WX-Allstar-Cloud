import { useState, type FormEvent } from "react";

import {
  useAutomationSchedule,
  useDeleteAutomationConnection,
  useSaveAutomationConnection,
  type AutomationActionKey,
  type SaveAutomationConnection,
} from "../api/nodes";
import { useDeviceRole } from "../state/deviceRole";
import { FlashBanner } from "./FlashBanner";

const actionOptions: { key: AutomationActionKey; label: string; needsTarget: boolean }[] = [
  { key: "connect_stay", label: "Connect (stay connected)", needsTarget: true },
  { key: "connect_listen", label: "Connect (listen only)", needsTarget: true },
  { key: "disconnect_one", label: "Disconnect a specific node", needsTarget: true },
  { key: "disconnect_all", label: "Disconnect all", needsTarget: false },
];

const weekdayOptions = [
  { value: "0", label: "Sun" },
  { value: "1", label: "Mon" },
  { value: "2", label: "Tue" },
  { value: "3", label: "Wed" },
  { value: "4", label: "Thu" },
  { value: "5", label: "Fri" },
  { value: "6", label: "Sat" },
];

const blank: SaveAutomationConnection = { action: "connect_stay", target: "", minute: "0", hour: "0", dom: "*", month: "*", weekdays: [] };

// AutomationScheduleSection edits app_rpt's own native connect/disconnect
// scheduler (cron-like, survives a reboot, keeps working even if this
// page isn't open) -- distinct from SoundScheduleSection's sound-playback
// ticker, which is this app's own JSON-file-driven mechanism.
export function AutomationScheduleSection({ deviceId, node }: { deviceId: string; node: string }) {
  const { data: rows, isLoading, error } = useAutomationSchedule(deviceId, node);
  const save = useSaveAutomationConnection(deviceId, node);
  const del = useDeleteAutomationConnection(deviceId, node);
  const { canEdit } = useDeviceRole();

  const [form, setForm] = useState<SaveAutomationConnection>(blank);
  const [flash, setFlash] = useState<{ kind: "ok" | "error"; message: string } | null>(null);

  const selectedAction = actionOptions.find((a) => a.key === form.action) ?? actionOptions[0];

  const toggleWeekday = (value: string) => {
    setForm((f) => ({ ...f, weekdays: f.weekdays.includes(value) ? f.weekdays.filter((w) => w !== value) : [...f.weekdays, value] }));
  };

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    setFlash(null);
    try {
      await save.mutateAsync(form);
      setForm(blank);
    } catch (err) {
      setFlash({ kind: "error", message: err instanceof Error ? err.message : "save failed" });
    }
  };

  const handleDelete = async (macroNum: string) => {
    if (!confirm(`Delete this scheduled connection?`)) {
      return;
    }
    try {
      await del.mutateAsync(macroNum);
    } catch (err) {
      setFlash({ kind: "error", message: err instanceof Error ? err.message : "delete failed" });
    }
  };

  return (
    <div className="card">
      <h2>Scheduled connections</h2>
      <p className="hint">
        Automatically connect or disconnect this node from another at specific days/times, using Asterisk's own scheduler
        directly — this keeps working even if this page isn't open, and across a reboot.
      </p>
      {isLoading && <p className="hint">Loading…</p>}
      {error && <div className="flash error">{(error as Error).message}</div>}
      {flash && <FlashBanner kind={flash.kind} message={flash.message} />}

      {rows && rows.length === 0 && <p className="hint">No scheduled connections yet.</p>}
      {rows && rows.length > 0 && (
        <div className="table-scroll">
          <table className="data-table" style={{ marginBottom: "1rem" }}>
            <thead>
              <tr>
                <th>Action</th>
                <th>Schedule (min hour dom month dow)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.macroNum}>
                  <td>{r.recognized ? r.label : <span className="hint">{r.label}</span>}</td>
                  <td>{r.timeSpec}</td>
                  <td>
                    <button className="danger" onClick={() => handleDelete(r.macroNum)} disabled={!canEdit}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form onSubmit={handleAdd}>
        <div className="row">
          <div className="field">
            <label htmlFor="automation_action">Action</label>
            <select id="automation_action" value={form.action} onChange={(e) => setForm((f) => ({ ...f, action: e.target.value as AutomationActionKey }))}>
              {actionOptions.map((a) => (
                <option key={a.key} value={a.key}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
          {selectedAction.needsTarget && (
            <div className="field">
              <label htmlFor="automation_target">Target node</label>
              <input id="automation_target" type="text" value={form.target} onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))} placeholder="2000" required />
            </div>
          )}
        </div>
        <div className="row">
          <div className="field">
            <label htmlFor="automation_minute">Minute</label>
            <input id="automation_minute" type="text" value={form.minute} onChange={(e) => setForm((f) => ({ ...f, minute: e.target.value }))} placeholder="0 or *" />
          </div>
          <div className="field">
            <label htmlFor="automation_hour">Hour</label>
            <input id="automation_hour" type="text" value={form.hour} onChange={(e) => setForm((f) => ({ ...f, hour: e.target.value }))} placeholder="0 or *" />
          </div>
          <div className="field">
            <label htmlFor="automation_dom">Day of month</label>
            <input id="automation_dom" type="text" value={form.dom} onChange={(e) => setForm((f) => ({ ...f, dom: e.target.value }))} placeholder="*" />
          </div>
          <div className="field">
            <label htmlFor="automation_month">Month</label>
            <input id="automation_month" type="text" value={form.month} onChange={(e) => setForm((f) => ({ ...f, month: e.target.value }))} placeholder="*" />
          </div>
        </div>
        <div className="field">
          <label>Days of week (none selected = every day)</label>
          <div className="row">
            {weekdayOptions.map((wd) => (
              <label key={wd.value} style={{ display: "flex", alignItems: "center", gap: "0.3rem", flex: "none" }}>
                <input type="checkbox" checked={form.weekdays.includes(wd.value)} onChange={() => toggleWeekday(wd.value)} />
                {wd.label}
              </label>
            ))}
          </div>
        </div>
        <div className="actions">
          <button type="submit" className="primary" disabled={save.isPending || !canEdit}>
            Add schedule entry
          </button>
        </div>
      </form>
    </div>
  );
}
