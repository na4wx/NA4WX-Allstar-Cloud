import { useEffect, useState, type FormEvent } from "react";

import { useIAXRegistration, useSaveIAXRegistration, type SaveIAXRegistration } from "../api/nodes";
import { useDeviceRole } from "../state/deviceRole";
import { FlashBanner } from "./FlashBanner";

const blank: SaveIAXRegistration = {
  password: "",
  host: "",
  port: "",
  peerType: "",
  peerContext: "",
  peerHost: "",
  peerSecret: "",
  peerAuth: "",
};

// AllstarNetworkTab edits the IAX2 registration + peer stanza that
// connects this node to the wider AllStarLink network -- see the Go
// app's internal/config/iax.go for why these are always saved together.
// Blank fields fall back to the same standard defaults the local app's
// own registration form applies (register.allstarlink.org, friend,
// radio-secure, dynamic, md5) -- see actions_iax.go's own doc comment.
export function AllstarNetworkTab({ deviceId, node }: { deviceId: string; node: string }) {
  const { data, isLoading, error } = useIAXRegistration(deviceId, node);
  const save = useSaveIAXRegistration(deviceId, node);
  const { canEdit } = useDeviceRole();
  const [form, setForm] = useState<SaveIAXRegistration>(blank);
  const [flash, setFlash] = useState<{ kind: "ok" | "error"; message: string } | null>(null);

  useEffect(() => {
    if (data) {
      setForm({
        password: data.registration?.password ?? "",
        host: data.registration?.host ?? "",
        port: data.registration?.port ?? "",
        peerType: data.peer?.type ?? "",
        peerContext: data.peer?.context ?? "",
        peerHost: data.peer?.host ?? "",
        peerSecret: data.peer?.secret ?? "",
        peerAuth: data.peer?.auth ?? "",
      });
    }
  }, [data]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFlash(null);
    try {
      await save.mutateAsync(form);
      setFlash({ kind: "ok", message: "AllStarLink registration saved." });
    } catch (err) {
      setFlash({ kind: "error", message: err instanceof Error ? err.message : "save failed" });
    }
  };

  return (
    <div className="card">
      <h2>AllStarLink network registration</h2>
      <p className="hint">
        Connects this node's app_rpt instance to the wider AllStarLink network. Leave any field but the password blank to use
        the standard defaults.
      </p>
      {isLoading && <p className="hint">Loading…</p>}
      {error && <div className="flash error">{(error as Error).message}</div>}
      {flash && <FlashBanner kind={flash.kind} message={flash.message} />}

      <form onSubmit={handleSubmit}>
        <div className="row">
          <div className="field">
            <label htmlFor="iax_password">Registration password</label>
            <input id="iax_password" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required />
          </div>
          <div className="field">
            <label htmlFor="iax_host">Registration host</label>
            <input id="iax_host" type="text" value={form.host} onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))} placeholder="register.allstarlink.org" />
          </div>
          <div className="field">
            <label htmlFor="iax_port">Registration port</label>
            <input id="iax_port" type="text" value={form.port} onChange={(e) => setForm((f) => ({ ...f, port: e.target.value }))} placeholder="4569" />
          </div>
        </div>

        <h3 style={{ marginTop: "1.25rem" }}>Peer settings</h3>
        <div className="row">
          <div className="field">
            <label htmlFor="iax_peer_type">Type</label>
            <input id="iax_peer_type" type="text" value={form.peerType} onChange={(e) => setForm((f) => ({ ...f, peerType: e.target.value }))} placeholder="friend" />
          </div>
          <div className="field">
            <label htmlFor="iax_peer_context">Context</label>
            <input id="iax_peer_context" type="text" value={form.peerContext} onChange={(e) => setForm((f) => ({ ...f, peerContext: e.target.value }))} placeholder="radio-secure" />
          </div>
          <div className="field">
            <label htmlFor="iax_peer_host">Host</label>
            <input id="iax_peer_host" type="text" value={form.peerHost} onChange={(e) => setForm((f) => ({ ...f, peerHost: e.target.value }))} placeholder="dynamic" />
          </div>
          <div className="field">
            <label htmlFor="iax_peer_secret">Secret</label>
            <input
              id="iax_peer_secret"
              type="password"
              value={form.peerSecret}
              onChange={(e) => setForm((f) => ({ ...f, peerSecret: e.target.value }))}
              placeholder="Defaults to the registration password"
            />
          </div>
          <div className="field">
            <label htmlFor="iax_peer_auth">Auth</label>
            <input id="iax_peer_auth" type="text" value={form.peerAuth} onChange={(e) => setForm((f) => ({ ...f, peerAuth: e.target.value }))} placeholder="md5" />
          </div>
        </div>

        <div className="actions">
          <button type="submit" className="primary" disabled={save.isPending || !canEdit}>
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
