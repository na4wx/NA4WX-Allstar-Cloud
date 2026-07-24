import { useState, type FormEvent } from "react";

import { useDeleteSoundSchedule, useSaveSoundSchedule, useSoundSchedule } from "../api/soundSchedule";
import { useSounds } from "../api/sounds";
import { useDeviceRole } from "../state/deviceRole";
import { FlashBanner } from "./FlashBanner";

const weekdayOptions = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];
const weekdayLabelByValue = new Map(weekdayOptions.map((w) => [w.value, w.label]));

// SoundScheduleSection manages one node's scheduled sound-playback
// entries -- see internal/soundschedule's package doc. Minute/hour/day
// fields use plain cron-style text ("*" or a number) rather than a
// picker, matching how app_rpt's own scheduler fields work. Days of
// week are a real multi-select list here (unlike the native
// "Scheduled connections" scheduler, which fans one weekday per entry)
// -- see internal/soundschedule.Entry's own doc comment for why: this
// is this app's own format, not constrained by app_rpt's schedule-stanza
// syntax.
export function SoundScheduleSection({ deviceId, node }: { deviceId: string; node: string }) {
  const { data: entries, isLoading, error } = useSoundSchedule(deviceId, node);
  const save = useSaveSoundSchedule(deviceId, node);
  const del = useDeleteSoundSchedule(deviceId, node);
  const { data: sounds } = useSounds(deviceId);
  const { canEdit } = useDeviceRole();

  const [file, setFile] = useState("");
  const [reach, setReach] = useState<"local" | "network">("local");
  const [minute, setMinute] = useState("0");
  const [hour, setHour] = useState("*");
  const [dayOfMonth, setDayOfMonth] = useState("*");
  const [month, setMonth] = useState("*");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [flash, setFlash] = useState<{ kind: "ok" | "error"; message: string } | null>(null);

  const toggleWeekday = (value: number) => {
    setDaysOfWeek((d) => (d.includes(value) ? d.filter((w) => w !== value) : [...d, value]));
  };

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    setFlash(null);
    try {
      await save.mutateAsync({ node, file, reach, minute, hour, day_of_month: dayOfMonth, month, days_of_week: daysOfWeek });
      setFlash({ kind: "ok", message: "Schedule entry saved." });
      setFile("");
      setDaysOfWeek([]);
    } catch (err) {
      setFlash({ kind: "error", message: err instanceof Error ? err.message : "save failed" });
    }
  };

  return (
    <div className="card">
      <h2>Sound schedule</h2>
      <p className="hint">Plays a sound file on a schedule, independent of app_rpt's own scheduler.</p>
      {flash && <FlashBanner kind={flash.kind} message={flash.message} />}

      {isLoading && <p className="hint">Loading…</p>}
      {error && <div className="flash error">{(error as Error).message}</div>}
      {entries && entries.length > 0 && (
        <table className="data-table" style={{ marginBottom: "1rem" }}>
          <thead>
            <tr>
              <th>File</th>
              <th>Reach</th>
              <th>Minute</th>
              <th>Hour</th>
              <th>Day</th>
              <th>Month</th>
              <th>Days of week</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td>{entry.file}</td>
                <td>{entry.reach}</td>
                <td>{entry.minute}</td>
                <td>{entry.hour}</td>
                <td>{entry.day_of_month}</td>
                <td>{entry.month}</td>
                <td>{entry.days_of_week && entry.days_of_week.length > 0 ? entry.days_of_week.map((d) => weekdayLabelByValue.get(d)).join(", ") : "Every day"}</td>
                <td>
                  <button className="danger" onClick={() => del.mutate(entry.id)} disabled={!canEdit}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form onSubmit={handleAdd}>
        <div className="row">
          <div className="field">
            <label htmlFor="sched_file">Sound file</label>
            <select id="sched_file" value={file} onChange={(e) => setFile(e.target.value)} required>
              <option value="">Choose a sound file</option>
              {sounds?.map((s) => (
                <option key={s.ref} value={s.ref}>
                  {s.name}
                  {!s.custom && " (built-in)"}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="sched_reach">Reach</label>
            <select id="sched_reach" value={reach} onChange={(e) => setReach(e.target.value as "local" | "network")}>
              <option value="local">Local only</option>
              <option value="network">Local + linked nodes</option>
            </select>
          </div>
        </div>
        <div className="row">
          <div className="field">
            <label htmlFor="sched_minute">Minute</label>
            <input id="sched_minute" type="text" value={minute} onChange={(e) => setMinute(e.target.value)} placeholder="0" />
          </div>
          <div className="field">
            <label htmlFor="sched_hour">Hour</label>
            <input id="sched_hour" type="text" value={hour} onChange={(e) => setHour(e.target.value)} placeholder="*" />
          </div>
          <div className="field">
            <label htmlFor="sched_dom">Day of month</label>
            <input id="sched_dom" type="text" value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)} placeholder="*" />
          </div>
          <div className="field">
            <label htmlFor="sched_month">Month</label>
            <input id="sched_month" type="text" value={month} onChange={(e) => setMonth(e.target.value)} placeholder="*" />
          </div>
        </div>
        <div className="field">
          <label>Days of week (none selected = every day)</label>
          <div className="row">
            {weekdayOptions.map((wd) => (
              <label key={wd.value} style={{ display: "flex", alignItems: "center", gap: "0.3rem", flex: "none" }}>
                <input type="checkbox" checked={daysOfWeek.includes(wd.value)} onChange={() => toggleWeekday(wd.value)} />
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
