import type { ReactNode } from "react";

export interface TabDef {
  id: string;
  label: string;
}

// Tabs is a plain controlled tab strip -- no routing, no animation. The
// caller owns `active` (NodeEditor syncs it to a `?tab=` query param so
// a link/refresh lands on the right tab) and just conditionally renders
// each panel's content itself; this component only renders the strip.
export function Tabs({ tabs, active, onChange }: { tabs: TabDef[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} type="button" role="tab" aria-selected={t.id === active} className={`tab ${t.id === active ? "active" : ""}`} onClick={() => onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function TabPanel({ id, active, children }: { id: string; active: string; children: ReactNode }) {
  if (id !== active) {
    return null;
  }
  return <div role="tabpanel">{children}</div>;
}
