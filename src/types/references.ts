export interface ReferenceImage {
  id: string;
  name: string;
  tags: string[];
  favorite: boolean;
  dataUrl: string;
  width: number;
  height: number;
  sourceUrl?: string;
  /** Folder the reference is filed in (references without one are "Sin carpeta"). */
  folder?: string;
  created: number;
  viewCount: number;
  lastViewedAt?: number;
}
