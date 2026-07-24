import { useEffect, useState } from "react";

import { useSetTelemetry, useTelemetry, type ToneSpec } from "../api/nodes";
import { useDeviceRole } from "../state/deviceRole";
import { FlashBanner } from "./FlashBanner";

const blankTone: ToneSpec = { freq1: 0, freq2: 0, durationMs: 0, amplitude: 0 };

// TelemetryRow edits one telemetry-stanza entry: a friendly per-field
// tone editor when the current value parses as exactly one
// tone-generator segment, otherwise a raw text field -- mirroring the
// local app's own ParseSingleTone-driven either/or editor.
function TelemetryRow({ deviceId, node, entryKey, value, tone }: { deviceId: string; node: string; entryKey: string; value: string; tone?: ToneSpec }) {
  const setTelemetry = useSetTelemetry(deviceId, node);
  const { canEdit } = useDeviceRole();
  const [toneForm, setToneForm] = useState<ToneSpec>(tone ?? blankTone);
  const [rawForm, setRawForm] = useState(value);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    setToneForm(tone ?? blankTone);
    setRawForm(value);
  }, [tone, value]);

  const handleSaveTone = async () => {
    setFlash(null);
    try {
      await setTelemetry.mutateAsync({ key: entryKey, value: `|t(${toneForm.freq1},${toneForm.freq2},${toneForm.durationMs},${toneForm.amplitude})` });
      setFlash("Saved.");
    } catch (err) {
      setFlash(err instanceof Error ? err.message : "save failed");
    }
  };

  const handleSaveRaw = async () => {
    setFlash(null);
    try {
      await setTelemetry.mutateAsync({ key: entryKey, value: rawForm });
      setFlash("Saved.");
    } catch (err) {
      setFlash(err instanceof Error ? err.message : "save failed");
    }
  };

  if (tone) {
    return (
      <tr>
        <td>{entryKey}</td>
        <td colSpan={4}>
          <div className="row" style={{ alignItems: "flex-end" }}>
            <div className="field">
              <label>Freq 1</label>
              <input type="number" value={toneForm.freq1} onChange={(e) => setToneForm((f) => ({ ...f, freq1: Number(e.target.value) }))} />
            </div>
            <div className="field">
              <label>Freq 2</label>
              <input type="number" value={toneForm.freq2} onChange={(e) => setToneForm((f) => ({ ...f, freq2: Number(e.target.value) }))} />
            </div>
            <div className="field">
              <label>Duration (ms)</label>
              <input type="number" value={toneForm.durationMs} onChange={(e) => setToneForm((f) => ({ ...f, durationMs: Number(e.target.value) }))} />
            </div>
            <div className="field">
              <label>Amplitude</label>
              <input type="number" value={toneForm.amplitude} onChange={(e) => setToneForm((f) => ({ ...f, amplitude: Number(e.target.value) }))} />
            </div>
            <div className="field" style={{ flex: "none" }}>
              <button type="button" onClick={handleSaveTone} disabled={setTelemetry.isPending || !canEdit}>
                Save
              </button>
            </div>
          </div>
          {flash && <span className="hint">{flash}</span>}
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td>{entryKey}</td>
      <td colSpan={4}>
        <div className="row" style={{ alignItems: "flex-end" }}>
          <div className="field">
            <input type="text" value={rawForm} onChange={(e) => setRawForm(e.target.value)} />
          </div>
          <div className="field" style={{ flex: "none" }}>
            <button type="button" onClick={handleSaveRaw} disabled={setTelemetry.isPending || !canEdit}>
              Save
            </button>
          </div>
        </div>
        {flash && <span className="hint">{flash}</span>}
      </td>
    </tr>
  );
}

// TelemetrySection lists a node's telemetry stanza (courtesy tones,
// named event tones, sound-file playback references) for editing --
// keys are fixed by app_rpt itself, so there's nothing to add or
// delete here, only edit (see internal/config.TelemetryEntry's own doc
// comment for why the key alone doesn't say which kind of value it holds).
export function TelemetrySection({ deviceId, node }: { deviceId: string; node: string }) {
  const { data: entries, isLoading, error } = useTelemetry(deviceId, node);

  return (
    <div className="card">
      <h2>Telemetry (tones &amp; sound references)</h2>
      <p className="hint">Each courtesy tone, event tone, or sound-file reference this node's telemetry section defines.</p>
      {isLoading && <p className="hint">Loading…</p>}
      {error && <div className="flash error">{(error as Error).message}</div>}
      {entries && entries.length === 0 && <p className="hint">No telemetry entries found.</p>}
      {entries && entries.length > 0 && (
        <div className="table-scroll">
          <table className="data-table">
            <tbody>
              {entries.map((e) => (
                <TelemetryRow key={e.key} deviceId={deviceId} node={node} entryKey={e.key} value={e.value} tone={e.tone} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
