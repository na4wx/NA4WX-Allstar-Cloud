// Direct port of the local Go app's .live-dot component -- lights up
// while a live (SSE) connection is actually open, same as the local
// app's own "Right now" card.
export function LiveDot({ on }: { on: boolean }) {
  return <span className={`live-dot ${on ? "on" : ""}`} title={on ? "Live" : "Not connected"} />;
}
