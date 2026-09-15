export type ModifierKey = 'ctrl' | 'shift' | 'alt';

export interface KeyCombo {
  key: string; // normalized: e.key.toLowerCase()
  modifiers: ModifierKey[];
}

export interface ShortcutDefinition {
  id: string;
  label: string;
  category: string;
  defaultKey: string;
  defaultModifiers: ModifierKey[];
  /** Whether the original hardcoded handler called preventDefault for this one — preserved
   * exactly so remapping doesn't change behavior around native browser shortcuts. */
  preventDefault: boolean;
}
