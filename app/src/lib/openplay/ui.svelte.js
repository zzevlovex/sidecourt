// Open play screen state that is not saved with the session.
import { load, KEYS } from '$lib/storage.js';

export const ui = $state({
  help: !load(KEYS.help), // the guide shows until the manager closes it once
  settingsOpen: false,
  resultsOpen: false,
  ending: false, // "End open play" dialog
  countLive: true, // count games still on court when ending
  pairing: null, // queue entry id choosing a partner
  finishing: null, // court id in the "Who won?" dialog
  finishScore: null,
  focusCheckin: false,
  scoring: null, // court id whose scorer link is shown
});

// Typed but not yet saved.
export const drafts = $state({ scores: {}, names: '', addedBy: '', mode: 'solo' });
