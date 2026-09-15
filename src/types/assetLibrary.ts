/**
 * Types for the Asset Library (patterns, gradients, textures).
 *
 * Brushes are deliberately NOT redefined here — the app already has a complete brush type
 * and library (`types/brush.types.ts`'s `Brush`, `appStore.brushLibrary`) wired into the real
 * drawing engine (`brush.service.ts`'s `strokeBrush`). A second, incompatible `Brush` shape
 * would just produce a disconnected gallery you could look at but never actually paint with.
 * The Asset Library's "Pinceles" tab reuses that existing type/store directly; `Brush` only
 * gained three new optional fields (`tags`, `favorite`, `folderId`) in `brush.types.ts`.
 */

export interface GradientStop {
  position: number; // 0-1
  color: string; // hex
}

export interface LibraryGradient {
  id: string;
  name: string;
  tags: string[];
  favorite: boolean;
  kind: 'linear' | 'radial';
  stops: GradientStop[];
  builtIn: boolean;
  created: number;
}

export interface LibraryPattern {
  id: string;
  name: string;
  tags: string[];
  favorite: boolean;
  tileDataUrl: string;
  tileWidth: number;
  tileHeight: number;
  created: number;
}

export interface LibraryTexture {
  id: string;
  name: string;
  tags: string[];
  favorite: boolean;
  dataUrl: string;
  width: number;
  height: number;
  created: number;
}

export interface LibraryPalette {
  id: string;
  name: string;
  tags: string[];
  favorite: boolean;
  colors: string[]; // hex
  builtIn: boolean;
  created: number;
}

export interface AssetSearchOptions {
  text?: string;
  favoriteOnly?: boolean;
}
