// Repeats a task while a page is open. When the app is in the background it
// runs every fifth time: enough for "you're up" alerts, with far less data used.
// Runs right away, and again as soon as the app comes back. Returns a stop function.
export function poll(task, ms) {
  let busy = false;
  let ticks = 0;
  const run = async () => {
    if (busy) return;
    busy = true;
    try {
      await task();
    } catch {
      // A failed check is simply tried again next time.
    } finally {
      busy = false;
    }
  };
  const tick = () => {
    ticks += 1;
    if (!document.hidden || ticks % 5 === 0) run();
  };
  const onShow = () => {
    if (!document.hidden) run();
  };
  const timer = setInterval(tick, ms);
  document.addEventListener('visibilitychange', onShow);
  run();
  return () => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onShow);
  };
}
