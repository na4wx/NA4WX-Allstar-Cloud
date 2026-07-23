import { useState, type FormEvent } from "react";

import { useDeleteWXTone, useSaveWXTone, useWXTones } from "../api/wxtone";
import { FlashBanner } from "./FlashBanner";

// WXToneSection lets an operator manage alert-driven courtesy-tone
// mappings for one node -- see HamVoipConfigGui's own internal/wxtone
// package doc for the feature itself. This form only creates
// sound-file-to-sound-file mappings (the safest, zero-Asterisk-touch
// case); a tone-type mapping created locally still displays correctly
// here, it just can't be created from this cloud form yet -- the local
// app's own Normal/WX tone-vs-file toggle isn't ported here yet.
export function WXToneSection({ deviceId, node }: { deviceId: string; node: string }) {
  const { data: entries, isLoading, error } = useWXTones(deviceId, node);
  const save = useSaveWXTone(deviceId, node);
  const del = useDeleteWXTone(deviceId, node);

  const [ctKey, setCtKey] = useState("");
  const [normalSound, setNormalSound] = useState("");
  const [wxSound, setWxSound] = useState("");
  const [flash, setFlash] = useState<{ kind: "ok" | "error"; message: string } | null>(null);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    setFlash(null);
    try {
      await save.mutateAsync({
        node,
        ct_key: ctKey,
        normal_type: "sound",
        normal_sound: normalSound,
        wx_type: "sound",
        wx_sound: wxSound,
      });
      setFlash({ kind: "ok", message: "Mapping saved." });
      setCtKey("");
      setNormalSound("");
      setWxSound("");
    } catch (err) {
      setFlash({ kind: "error", message: err instanceof Error ? err.message : "save failed" });
    }
  };

  return (
    <div className="card">
      <div className="label-row">
        <h2 style={{ margin: 0 }}>WX courtesy tone</h2>
      </div>
      <p className="hint">Swaps a courtesy tone's sound file when SkywarnPlus reports an active weather alert for this node.</p>
      {flash && <FlashBanner kind={flash.kind} message={flash.message} />}

      {isLoading && <p className="hint">Loading…</p>}
      {error && <div className="flash error">{(error as Error).message}</div>}
      {entries && entries.length > 0 && (
        <table className="data-table" style={{ marginBottom: "1rem" }}>
          <thead>
            <tr>
              <th>Courtesy tone</th>
              <th>Normal</th>
              <th>WX</th>
              <th>Current</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td>{entry.ct_key}</td>
                <td>{entry.normal_type === "tone" ? entry.normal_tone : entry.normal_sound}</td>
                <td>{entry.wx_type === "tone" ? entry.wx_tone : entry.wx_sound}</td>
                <td>{entry.mode === "wx" ? "WX" : "Normal"}</td>
                <td>
                  <button className="danger" onClick={() => del.mutate(entry.id)}>
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
            <label htmlFor="wxtone_ctkey">Courtesy tone key</label>
            <input id="wxtone_ctkey" type="text" value={ctKey} onChange={(e) => setCtKey(e.target.value)} placeholder="ct1" required />
          </div>
          <div className="field">
            <label htmlFor="wxtone_normal">Normal sound</label>
            <input id="wxtone_normal" type="text" value={normalSound} onChange={(e) => setNormalSound(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="wxtone_wx">WX sound</label>
            <input id="wxtone_wx" type="text" value={wxSound} onChange={(e) => setWxSound(e.target.value)} required />
          </div>
        </div>
        <div className="actions">
          <button type="submit" className="primary" disabled={save.isPending}>
            Add mapping
          </button>
        </div>
      </form>
    </div>
  );
}
