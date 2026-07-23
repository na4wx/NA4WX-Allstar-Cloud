import { useState, type FormEvent } from "react";

import { useDeleteFunctionMacro, useFunctionMacros, useSaveFunctionMacro, type FunctionMacroKind } from "../api/nodes";
import { FlashBanner } from "./FlashBanner";

// FunctionMacroTable renders one of the local app's "Command list"
// (kind=functions) or "Saved macros" (kind=macro) cards -- same table
// shape, same add/delete form, distinguished only by kind.
export function FunctionMacroTable({
  deviceId,
  node,
  kind,
  title,
  digitsLabel,
  digitsPlaceholder,
  commandLabel,
  commandPlaceholder,
  commandListId,
}: {
  deviceId: string;
  node: string;
  kind: FunctionMacroKind;
  title: string;
  digitsLabel: string;
  digitsPlaceholder: string;
  commandLabel: string;
  commandPlaceholder: string;
  commandListId?: string;
}) {
  const { data: macros, isLoading, error } = useFunctionMacros(deviceId, node, kind);
  const save = useSaveFunctionMacro(deviceId, node, kind);
  const del = useDeleteFunctionMacro(deviceId, node, kind);

  const [digits, setDigits] = useState("");
  const [command, setCommand] = useState("");
  const [flash, setFlash] = useState<{ kind: "ok" | "error"; message: string } | null>(null);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    setFlash(null);
    try {
      await save.mutateAsync({ digits, command });
      setDigits("");
      setCommand("");
    } catch (err) {
      setFlash({ kind: "error", message: err instanceof Error ? err.message : "save failed" });
    }
  };

  const handleDelete = async (d: string) => {
    if (!confirm(`Delete ${d}?`)) {
      return;
    }
    try {
      await del.mutateAsync(d);
    } catch (err) {
      setFlash({ kind: "error", message: err instanceof Error ? err.message : "delete failed" });
    }
  };

  return (
    <div className="card">
      <h2>{title}</h2>
      {isLoading && <p className="hint">Loading…</p>}
      {error && <div className="flash error">{(error as Error).message}</div>}
      {flash && <FlashBanner kind={flash.kind} message={flash.message} />}
      {macros && macros.length === 0 && <p className="hint">No commands defined yet.</p>}
      {macros && macros.length > 0 && (
        <div className="table-scroll">
          <table className="data-table" style={{ marginBottom: "1rem" }}>
            <thead>
              <tr>
                <th>Digits</th>
                <th>Command</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {macros.map((m) => (
                <tr key={m.digits}>
                  <td>{m.digits}</td>
                  <td>{m.command}</td>
                  <td>
                    <button className="danger" onClick={() => handleDelete(m.digits)}>
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
            <label htmlFor={`${kind}_digits`}>{digitsLabel}</label>
            <input id={`${kind}_digits`} type="text" value={digits} onChange={(e) => setDigits(e.target.value)} placeholder={digitsPlaceholder} required />
          </div>
          <div className="field">
            <label htmlFor={`${kind}_command`}>{commandLabel}</label>
            <input
              id={`${kind}_command`}
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder={commandPlaceholder}
              list={commandListId}
              required
            />
          </div>
        </div>
        <div className="actions">
          <button type="submit" className="primary" disabled={save.isPending}>
            Add / update
          </button>
        </div>
      </form>
    </div>
  );
}
