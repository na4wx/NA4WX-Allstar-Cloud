import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";

import { useDevice } from "../api/devices";
import { useDeleteSound, useSounds, useUploadSound } from "../api/sounds";
import { FlashBanner } from "../components/FlashBanner";

export function SoundsManager() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const { data: device } = useDevice(deviceId!);
  const { data: sounds, isLoading, error } = useSounds(deviceId!);
  const upload = useUploadSound(deviceId!);
  const deleteSound = useDeleteSound(deviceId!);

  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [flash, setFlash] = useState<{ kind: "ok" | "error"; message: string } | null>(null);

  const handleUpload = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) {
      return;
    }
    setFlash(null);
    try {
      await upload.mutateAsync({ name, file });
      setFlash({ kind: "ok", message: `"${name}" uploaded.` });
      setName("");
      setFile(null);
    } catch (err) {
      setFlash({ kind: "error", message: err instanceof Error ? err.message : "upload failed" });
    }
  };

  const handleDelete = (soundName: string) => {
    if (!confirm(`Delete "${soundName}"? This can't be undone.`)) {
      return;
    }
    deleteSound.mutate(soundName);
  };

  const custom = sounds?.filter((s) => s.custom) ?? [];
  const stock = sounds?.filter((s) => !s.custom) ?? [];

  return (
    <div>
      <p>
        <Link to={`/devices/${deviceId}`}>&larr; {device?.name ?? "Device"}</Link>
      </p>
      <h1>Sounds</h1>
      {flash && <FlashBanner kind={flash.kind} message={flash.message} />}

      <div className="card">
        <h2>Upload a sound</h2>
        <form onSubmit={handleUpload}>
          <div className="row">
            <div className="field">
              <label htmlFor="sound_name">Name</label>
              <input id="sound_name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. station-id" required />
            </div>
            <div className="field">
              <label htmlFor="sound_file">Audio file</label>
              <input id="sound_file" type="file" accept="audio/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
            </div>
          </div>
          <div className="actions">
            <button type="submit" className="primary" disabled={upload.isPending}>
              Upload
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2>Your custom sounds</h2>
        {isLoading && <p className="hint">Loading…</p>}
        {error && <div className="flash error">{(error as Error).message}</div>}
        {custom.length === 0 && !isLoading && <p className="hint">No custom sounds uploaded yet.</p>}
        {custom.length > 0 && (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {custom.map((s) => (
                  <tr key={s.name}>
                    <td>{s.name}</td>
                    <td>
                      <button className="danger" onClick={() => handleDelete(s.name)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Stock library</h2>
        <p className="hint">app_rpt's own built-in prompts — read-only reference, never modified here.</p>
        <div className="row">
          {stock.map((s) => (
            <span key={s.name} className="tag">
              {s.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
