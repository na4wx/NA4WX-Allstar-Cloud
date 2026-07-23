import { useEffect, useState, type FormEvent } from "react";

import { useNode, useSaveCourtesyTones, type CourtesyTones } from "../api/nodes";
import { FlashBanner } from "./FlashBanner";

const blank: CourtesyTones = { unlinkedCT: "", remoteCT: "", linkUnkeyCT: "" };

// CourtesyToneSection edits the three courtesy-tone assignment fields
// SaveNode's own field allowlist deliberately excludes (see the Go
// app's Store.SaveNode doc comment) -- a separate narrow-write action,
// same as the local app's own "When each courtesy tone plays" card.
export function CourtesyToneSection({ deviceId, node }: { deviceId: string; node: string }) {
  const { data: existing, isLoading } = useNode(deviceId, node);
  const save = useSaveCourtesyTones(deviceId, node);
  const [form, setForm] = useState<CourtesyTones>(blank);
  const [flash, setFlash] = useState<{ kind: "ok" | "error"; message: string } | null>(null);

  useEffect(() => {
    if (existing) {
      setForm({ unlinkedCT: existing.unlinkedCT, remoteCT: existing.remoteCT, linkUnkeyCT: existing.linkUnkeyCT });
    }
  }, [existing]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFlash(null);
    try {
      await save.mutateAsync(form);
      setFlash({ kind: "ok", message: "Courtesy tones saved." });
    } catch (err) {
      setFlash({ kind: "error", message: err instanceof Error ? err.message : "save failed" });
    }
  };

  return (
    <div className="card">
      <h2>When each courtesy tone plays</h2>
      <p className="hint">Which telemetry key plays for an unlinked node, a remote-linked node, and a link-unkey event.</p>
      {isLoading && <p className="hint">Loading…</p>}
      {flash && <FlashBanner kind={flash.kind} message={flash.message} />}
      <form onSubmit={handleSubmit}>
        <div className="row">
          <div className="field">
            <label htmlFor="ct_unlinked">Unlinked</label>
            <input id="ct_unlinked" type="text" value={form.unlinkedCT} onChange={(e) => setForm((f) => ({ ...f, unlinkedCT: e.target.value }))} placeholder="ct1" />
          </div>
          <div className="field">
            <label htmlFor="ct_remote">Remote-linked</label>
            <input id="ct_remote" type="text" value={form.remoteCT} onChange={(e) => setForm((f) => ({ ...f, remoteCT: e.target.value }))} placeholder="ct2" />
          </div>
          <div className="field">
            <label htmlFor="ct_linkunkey">Link unkey</label>
            <input id="ct_linkunkey" type="text" value={form.linkUnkeyCT} onChange={(e) => setForm((f) => ({ ...f, linkUnkeyCT: e.target.value }))} placeholder="ct3" />
          </div>
        </div>
        <div className="actions">
          <button type="submit" className="primary" disabled={save.isPending}>
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
