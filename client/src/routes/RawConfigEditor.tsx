import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { useAddRawConfigKey, useAddRawConfigSection, useRawConfigFile, useRawConfigFiles, useSetRawConfigKey } from "../api/rawconfig";
import { StepUpCancelledError, ensureStepUp } from "../api/stepUp";
import { FlashBanner } from "../components/FlashBanner";

// RawConfigEditor is a direct port of the local Go app's own Raw Config
// page: edit any Asterisk config file's sections/keys with no
// higher-level validation at all. Refused by the device itself unless
// its own "Allow remote raw config editing" setting is on -- see
// internal/cloudagent/actions_rawconfig.go.
export function RawConfigEditor() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const { data: files } = useRawConfigFiles(deviceId!);
  const [selectedFile, setSelectedFile] = useState("");
  const { data: fileData, isLoading, error } = useRawConfigFile(deviceId!, selectedFile);
  const setKey = useSetRawConfigKey(deviceId!, selectedFile);
  const addKey = useAddRawConfigKey(deviceId!, selectedFile);
  const addSection = useAddRawConfigSection(deviceId!, selectedFile);

  const [flash, setFlash] = useState<{ kind: "ok" | "error"; message: string } | null>(null);
  const [newKeySection, setNewKeySection] = useState("");
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyValue, setNewKeyValue] = useState("");
  const [newSectionName, setNewSectionName] = useState("");

  const handleSaveKey = async (section: string, index: number, value: string) => {
    if (!confirm(`Change this value in ${selectedFile}? There is no undo.`)) {
      return;
    }
    setFlash(null);
    try {
      const stepUpToken = await ensureStepUp();
      await setKey.mutateAsync({ section, index, value, stepUpToken });
      setFlash({ kind: "ok", message: "Saved." });
    } catch (err) {
      if (err instanceof StepUpCancelledError) {
        return;
      }
      setFlash({ kind: "error", message: err instanceof Error ? err.message : "save failed" });
    }
  };

  const handleAddKey = async () => {
    setFlash(null);
    try {
      const stepUpToken = await ensureStepUp();
      await addKey.mutateAsync({ section: newKeySection, key: newKeyName, value: newKeyValue, stepUpToken });
      setFlash({ kind: "ok", message: "Key added." });
      setNewKeyName("");
      setNewKeyValue("");
    } catch (err) {
      if (err instanceof StepUpCancelledError) {
        return;
      }
      setFlash({ kind: "error", message: err instanceof Error ? err.message : "failed" });
    }
  };

  const handleAddSection = async () => {
    setFlash(null);
    try {
      const stepUpToken = await ensureStepUp();
      await addSection.mutateAsync({ section: newSectionName, stepUpToken });
      setFlash({ kind: "ok", message: "Section added." });
      setNewSectionName("");
    } catch (err) {
      if (err instanceof StepUpCancelledError) {
        return;
      }
      setFlash({ kind: "error", message: err instanceof Error ? err.message : "failed" });
    }
  };

  return (
    <div>
      <p>
        <Link to={`/devices/${deviceId}`}>&larr; Device</Link>
      </p>
      <h1>Raw config</h1>

      <div className="card" style={{ borderColor: "var(--danger)" }}>
        <h2 style={{ color: "var(--danger)" }}>No safety net</h2>
        <p>
          This edits the device's actual config files directly, with none of the validation the rest of this app applies
          elsewhere. A bad value here can stop Asterisk from starting. Refused unless "Allow remote raw config editing" is
          turned on in that device's own Cloud Sync settings.
        </p>
      </div>

      {flash && <FlashBanner kind={flash.kind} message={flash.message} />}

      <div className="card">
        <div className="field">
          <label htmlFor="rc_file">File</label>
          <select id="rc_file" value={selectedFile} onChange={(e) => setSelectedFile(e.target.value)}>
            <option value="">Choose a file</option>
            {files?.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedFile && (
        <div className="card">
          <h2>{selectedFile}</h2>
          {isLoading && <p className="hint">Loading…</p>}
          {error && (
            <p className="hint">
              {error instanceof Error ? error.message : "Couldn't load this file — is remote raw config editing enabled on this device?"}
            </p>
          )}
          {fileData?.sections.map((section) => (
            <div key={section.name} style={{ marginBottom: "1.25rem" }}>
              <h3 style={{ fontSize: "0.95rem", marginBottom: "0.5rem" }}>[{section.name}]</h3>
              <table className="data-table">
                <tbody>
                  {section.keys.map((kv, index) => (
                    <tr key={index}>
                      <td className="nowrap">{kv.key}</td>
                      <td>
                        <RawValueEditor value={kv.value} onSave={(v) => handleSaveKey(section.name, index, v)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          <details style={{ marginTop: "1rem" }}>
            <summary style={{ cursor: "pointer", color: "var(--text-dim)" }}>Add a key</summary>
            <div className="row" style={{ marginTop: "0.75rem" }}>
              <div className="field">
                <label>Section</label>
                <input type="text" value={newKeySection} onChange={(e) => setNewKeySection(e.target.value)} />
              </div>
              <div className="field">
                <label>Key</label>
                <input type="text" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} />
              </div>
              <div className="field">
                <label>Value</label>
                <input type="text" value={newKeyValue} onChange={(e) => setNewKeyValue(e.target.value)} />
              </div>
              <div className="field" style={{ flex: "none", alignSelf: "flex-end" }}>
                <button onClick={handleAddKey} disabled={addKey.isPending}>
                  Add
                </button>
              </div>
            </div>
          </details>

          <details style={{ marginTop: "0.75rem" }}>
            <summary style={{ cursor: "pointer", color: "var(--text-dim)" }}>Add a section</summary>
            <div className="row" style={{ marginTop: "0.75rem" }}>
              <div className="field">
                <label>Section name</label>
                <input type="text" value={newSectionName} onChange={(e) => setNewSectionName(e.target.value)} />
              </div>
              <div className="field" style={{ flex: "none", alignSelf: "flex-end" }}>
                <button onClick={handleAddSection} disabled={addSection.isPending}>
                  Add
                </button>
              </div>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

function RawValueEditor({ value, onSave }: { value: string; onSave: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  const dirty = draft !== value;
  return (
    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
      <input type="text" value={draft} onChange={(e) => setDraft(e.target.value)} style={{ flex: 1 }} />
      {dirty && (
        <button className="primary" onClick={() => onSave(draft)}>
          Save
        </button>
      )}
    </div>
  );
}
