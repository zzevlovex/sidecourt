// Small text helpers shared by the pages.

export const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
export const teamNames = (team) => team.p.join(' & ');
export const pct = (p) => (p.wins + p.losses ? `${Math.round(p.winRate * 100)}%` : '–');
export const signed = (n) => (n > 0 ? `+${n}` : String(n));

// Reads text out loud so players do not need to look at a phone.
export function speak(text) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}
