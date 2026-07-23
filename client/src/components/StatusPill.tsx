// Direct port of the local Go app's .status-pill component (see
// web/static/css/style.css) -- up/down there maps to online/offline
// here.
export function StatusPill({ status }: { status: "online" | "offline" }) {
  const up = status === "online";
  return (
    <span className={`status-pill ${up ? "up" : "down"}`}>
      <span className="dot" />
      {up ? "Online" : "Offline"}
    </span>
  );
}
