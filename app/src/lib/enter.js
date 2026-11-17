// Entrance animations only for things that appear AFTER a page has loaded
// (a new game on a court, a new call), not for everything on first paint.
//
//   <div use:enter={'pop glow'}>   adds those classes if the page has settled
//
// Pages call settleSoon() while they set up.
let settled = false;

export function settleSoon() {
  settled = false;
  requestAnimationFrame(() => requestAnimationFrame(() => (settled = true)));
}

export function enter(node, classes) {
  if (settled) node.classList.add(...classes.split(' '));
}
