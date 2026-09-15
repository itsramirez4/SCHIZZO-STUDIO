/** A saved set of parameter values for one specific filter (identified by `filterId`, e.g.
 * "twirl" or "duotone") — global and cross-project, like the perspective-grid presets, since a
 * preset like "strong twirl" is something you'd reuse across many different drawings. */
export interface FilterPreset {
  id: string;
  filterId: string;
  name: string;
  params: Record<string, number | string>;
}
