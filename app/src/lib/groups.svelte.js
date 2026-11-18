// Saved player lists ("Friday regulars") for one-tap check-in. Kept on this device.
import { load, save, KEYS } from '$lib/storage.js';

export const groups = $state({ list: load(KEYS.groups, []) });

// Saving a name that already exists replaces that group.
export function saveGroup(name, names) {
  const clean = name.trim();
  groups.list = [...groups.list.filter((g) => g.name.toLowerCase() !== clean.toLowerCase()), { name: clean, names }];
  save(KEYS.groups, groups.list);
}

export function removeGroup(name) {
  groups.list = groups.list.filter((g) => g.name !== name);
  save(KEYS.groups, groups.list);
}
