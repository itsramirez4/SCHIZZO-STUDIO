import { KeyCombo, ModifierKey, ShortcutDefinition } from '@/types/shortcuts';

/** metaKey (Cmd on Mac) is treated as equivalent to ctrlKey — matches the original hardcoded
 * handler's `e.ctrlKey || e.metaKey` check exactly. */
export function comboFromEvent(e: KeyboardEvent): KeyCombo {
  const modifiers: ModifierKey[] = [];
  if (e.ctrlKey || e.metaKey) modifiers.push('ctrl');
  if (e.shiftKey) modifiers.push('shift');
  if (e.altKey) modifiers.push('alt');
  return { key: e.key.toLowerCase(), modifiers };
}

export function combosEqual(a: KeyCombo, b: KeyCombo): boolean {
  if (a.key !== b.key) return false;
  if (a.modifiers.length !== b.modifiers.length) return false;
  return a.modifiers.every((m) => b.modifiers.includes(m));
}

const MODIFIER_LABELS: Record<ModifierKey, string> = { ctrl: 'Ctrl', shift: 'Shift', alt: 'Alt' };
const KEY_LABELS: Record<string, string> = {
  ' ': 'Espacio',
  arrowup: '↑',
  arrowdown: '↓',
  arrowleft: '←',
  arrowright: '→',
  escape: 'Esc',
};

export function formatCombo(combo: KeyCombo): string {
  const parts = combo.modifiers.map((m) => MODIFIER_LABELS[m]);
  parts.push(KEY_LABELS[combo.key] ?? (combo.key.length === 1 ? combo.key.toUpperCase() : combo.key));
  return parts.join('+');
}

export function defaultCombo(def: ShortcutDefinition): KeyCombo {
  return { key: def.defaultKey, modifiers: def.defaultModifiers };
}

/** `null` in overrides means the user explicitly disabled that shortcut; absent means "use the
 * default". Returns `null` if the shortcut is currently disabled. */
export function effectiveCombo(def: ShortcutDefinition, overrides: Record<string, KeyCombo | null>): KeyCombo | null {
  if (def.id in overrides) return overrides[def.id];
  return defaultCombo(def);
}

/** Finds whichever definition (if any) currently owns `combo`, given the current overrides —
 * this is the single source of truth both the live keydown handler and the reassignment UI's
 * conflict warning use, so they can never disagree about what a key currently does. */
export function findDefinitionForCombo(
  combo: KeyCombo,
  definitions: ShortcutDefinition[],
  overrides: Record<string, KeyCombo | null>,
  excludeId?: string
): ShortcutDefinition | null {
  for (const def of definitions) {
    if (def.id === excludeId) continue;
    const effective = effectiveCombo(def, overrides);
    if (effective && combosEqual(effective, combo)) return def;
  }
  return null;
}
