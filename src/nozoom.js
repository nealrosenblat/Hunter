// iOS Safari ignores the viewport's "no zoom" settings, so two thumbs on the screen
// (stick + turn) read as a pinch and quick taps on FIRE read as a double-tap zoom.
// Block those gestures, and if the page ends up zoomed anyway, snap it back.

export function preventZoom() {
  const stop = (e) => e.preventDefault();
  // WebKit-only pinch events
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, stop, { passive: false });
  // multi-finger moves = pinch
  document.addEventListener('touchmove', (e) => {
    if (e.touches.length > 1 || (e.scale !== undefined && e.scale !== 1)) e.preventDefault();
  }, { passive: false });
  // double-tap zoom (menus and buttons use pointer events, so cancelling the click is harmless)
  let lastEnd = 0;
  document.addEventListener('touchend', (e) => {
    if (e.timeStamp - lastEnd < 400) e.preventDefault();
    lastEnd = e.timeStamp;
  }, { passive: false });
  // long-press magnifier / callout
  document.addEventListener('contextmenu', stop);
  document.addEventListener('selectstart', stop);

  // If a zoom slips through, rewriting the viewport tag makes Safari reset the scale.
  const vv = window.visualViewport;
  const meta = document.querySelector('meta[name=viewport]');
  if (!vv || !meta) return;
  const base = meta.content;
  let t = 0;
  const check = () => {
    if (vv.scale <= 1.01) return;
    clearTimeout(t);
    t = setTimeout(() => {
      meta.content = base + ', minimum-scale=1, user-scalable=no';
      requestAnimationFrame(() => { meta.content = base; window.scrollTo(0, 0); });
    }, 150);
  };
  vv.addEventListener('resize', check);
  vv.addEventListener('scroll', check);
}
