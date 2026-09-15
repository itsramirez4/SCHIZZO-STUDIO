import { AssetSearchOptions } from '@/types/assetLibrary';

interface Searchable {
  name: string;
  tags?: string[];
  favorite?: boolean;
}

export function filterAssets<T extends Searchable>(items: T[], options: AssetSearchOptions): T[] {
  let result = items;
  if (options.text) {
    const text = options.text.toLowerCase();
    result = result.filter((item) => {
      const haystack = `${item.name} ${(item.tags ?? []).join(' ')}`.toLowerCase();
      return haystack.includes(text);
    });
  }
  if (options.favoriteOnly) {
    result = result.filter((item) => item.favorite);
  }
  return result;
}
