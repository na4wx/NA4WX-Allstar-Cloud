// Direct port of the local Go app's .flash/.flash.error/.flash.ok
// banners (see web/static/css/style.css) -- same visual language for
// "this save worked" / "this save failed" feedback.
export function FlashBanner({ kind, message }: { kind: "ok" | "error"; message: string }) {
  return <div className={`flash ${kind}`}>{message}</div>;
}
