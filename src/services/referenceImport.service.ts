import { v4 as uuid } from 'uuid';
import { ReferenceImage } from '@/types/references';
import { dataUrlToImage } from '@/utils/canvasUtils';

export async function buildReferenceFromDataUrl(dataUrl: string, name: string, sourceUrl?: string): Promise<ReferenceImage> {
  const img = await dataUrlToImage(dataUrl);
  return {
    id: uuid(),
    name,
    tags: [],
    favorite: false,
    dataUrl,
    width: img.width,
    height: img.height,
    sourceUrl,
    created: Date.now(),
    viewCount: 0,
  };
}
