export interface ReferenceImage {
  id: string;
  name: string;
  tags: string[];
  favorite: boolean;
  dataUrl: string;
  width: number;
  height: number;
  sourceUrl?: string;
  created: number;
  viewCount: number;
  lastViewedAt?: number;
}
