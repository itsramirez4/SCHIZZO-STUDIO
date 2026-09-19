/**
 * In-app reference search over Wikimedia Commons (freely licensed images). Uses the public
 * MediaWiki API, which needs no key and allows cross-origin requests. Requires an internet
 * connection; everything already saved in the reference library keeps working offline.
 */

export interface ReferenceSearchResult {
  id: number;
  title: string;
  thumbUrl: string;
  /** A medium-size version (≈1000 px wide) suitable for saving as a reference. */
  imageUrl: string;
  pageUrl: string;
  license: string;
  author: string;
}

const strip = (html?: string) => (html ?? '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').trim();

export async function searchReferences(query: string, limit = 24, offset = 0): Promise<ReferenceSearchResult[]> {
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: `${query} filetype:bitmap`,
    gsrnamespace: '6',
    gsrlimit: String(limit),
    gsroffset: String(offset),
    prop: 'imageinfo',
    iiprop: 'url|extmetadata|mime',
    iiurlwidth: '1000',
    iiextmetadatafilter: 'LicenseShortName|Artist',
    format: 'json',
    origin: '*',
  });
  const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params.toString()}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const pages = Object.values(json?.query?.pages ?? {}) as any[];
  return pages
    .filter((p) => p.imageinfo?.[0] && /^image\/(jpeg|png|webp)/.test(p.imageinfo[0].mime ?? ''))
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((p) => {
      const info = p.imageinfo[0];
      return {
        id: p.pageid,
        title: String(p.title).replace(/^File:/, '').replace(/\.[a-z0-9]+$/i, ''),
        thumbUrl: info.thumburl ?? info.url,
        imageUrl: info.thumburl ?? info.url,
        pageUrl: info.descriptionurl ?? `https://commons.wikimedia.org/?curid=${p.pageid}`,
        license: strip(info.extmetadata?.LicenseShortName?.value) || 'Ver licencia en Commons',
        author: strip(info.extmetadata?.Artist?.value),
      };
    });
}

/** Downloads an image as a data URL (Commons serves permissive CORS headers). */
export async function fetchAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
