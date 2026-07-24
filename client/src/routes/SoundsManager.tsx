import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";

import { useDevice } from "../api/devices";
import { useDeleteSound, useSaveGeneratedSound, useSounds, useUploadSound, soundPreviewUrl } from "../api/sounds";
import { useGenerateSpeech, useTtsVoices } from "../api/tts";
import { FlashBanner } from "../components/FlashBanner";

export function SoundsManager() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const { data: device } = useDevice(deviceId!);
  // This route isn't nested inside NodeEditor's tree (it's its own
  // top-level /devices/:deviceId/sounds route), so there's no
  // DeviceRoleProvider to read from -- computed directly from the
  // device this page already fetches, same as NodeEditor's own
  // top-level canEdit.
  const canEdit = device ? device.role !== "viewer" : true;
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

  // Revealed lazily, per row -- clicking "Play" mounts an <audio> element
  // pointed at the preview URL rather than every row firing a relay call
  // the moment this page loads.
  const [revealedPreviews, setRevealedPreviews] = useState<Set<string>>(new Set());
  const revealPreview = (soundName: string) => setRevealedPreviews((prev) => new Set(prev).add(soundName));

  const voicesQuery = useTtsVoices(deviceId!);
  const generateSpeech = useGenerateSpeech(deviceId!);
  const saveGenerated = useSaveGeneratedSound(deviceId!);

  const [ttsName, setTtsName] = useState("");
  const [ttsText, setTtsText] = useState("");
  const [ttsVoice, setTtsVoice] = useState("");
  const [generatedAudio, setGeneratedAudio] = useState<string | null>(null);
  const [ttsFlash, setTtsFlash] = useState<{ kind: "ok" | "error"; message: string } | null>(null);

  const handleGenerate = async (e: FormEvent) => {
    e.preventDefault();
    setTtsFlash(null);
    setGeneratedAudio(null);
    try {
      const result = await generateSpeech.mutateAsync({ text: ttsText, voice: ttsVoice });
      setGeneratedAudio(result.dataBase64);
    } catch (err) {
      setTtsFlash({ kind: "error", message: err instanceof Error ? err.message : "generation failed" });
    }
  };

  const handleSendGeneratedToDevice = async () => {
    if (!generatedAudio) {
      return;
    }
    setTtsFlash(null);
    try {
      await saveGenerated.mutateAsync({ name: ttsName, dataBase64: generatedAudio });
      setTtsFlash({ kind: "ok", message: `"${ttsName}" sent to device.` });
      setTtsName("");
      setTtsText("");
      setGeneratedAudio(null);
    } catch (err) {
      setTtsFlash({ kind: "error", message: err instanceof Error ? err.message : "send failed" });
    }
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
            <button type="submit" className="primary" disabled={upload.isPending || !canEdit}>
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
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {custom.map((s) => (
                  <tr key={s.name}>
                    <td>{s.name}</td>
                    <td>
                      {revealedPreviews.has(s.name) ? (
                        <audio controls autoPlay src={soundPreviewUrl(deviceId!, s.name)} style={{ height: "2rem", maxWidth: "220px" }} />
                      ) : (
                        <button onClick={() => revealPreview(s.name)}>Play</button>
                      )}
                    </td>
                    <td>
                      <button className="danger" onClick={() => handleDelete(s.name)} disabled={!canEdit}>
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
        <h2>Generate from text</h2>
        <p className="hint">
          Synthesized on the cloud service itself (free, offline text-to-speech), so it works regardless of this device's own
          hardware. Preview it here, then send it to the device once you're happy with it.
        </p>
        {ttsFlash && <FlashBanner kind={ttsFlash.kind} message={ttsFlash.message} />}
        {voicesQuery.data && voicesQuery.data.length === 0 && (
          <p className="hint">No voices are configured on the cloud service yet — ask its operator to add one.</p>
        )}
        <form onSubmit={handleGenerate}>
          <div className="row">
            <div className="field">
              <label htmlFor="tts_name">Name</label>
              <input id="tts_name" type="text" value={ttsName} onChange={(e) => setTtsName(e.target.value)} placeholder="e.g. weather-advisory" required />
            </div>
            <div className="field">
              <label htmlFor="tts_voice">Voice</label>
              <select id="tts_voice" value={ttsVoice} onChange={(e) => setTtsVoice(e.target.value)} required>
                <option value="">Choose a voice</option>
                {voicesQuery.data?.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="tts_text">Text to speak</label>
            <textarea
              id="tts_text"
              value={ttsText}
              onChange={(e) => setTtsText(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="e.g. This is the W1ABC repeater."
              required
            />
            <div className="hint">{ttsText.length}/500</div>
          </div>
          <div className="actions">
            <button type="submit" className="primary" disabled={generateSpeech.isPending}>
              {generateSpeech.isPending ? "Generating…" : "Generate"}
            </button>
          </div>
        </form>
        {generatedAudio && (
          <div style={{ marginTop: "1rem" }}>
            <audio controls autoPlay src={`data:audio/wav;base64,${generatedAudio}`} style={{ width: "100%" }} />
            <div className="actions">
              <button className="primary" onClick={handleSendGeneratedToDevice} disabled={saveGenerated.isPending || !canEdit}>
                Send to device
              </button>
            </div>
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
