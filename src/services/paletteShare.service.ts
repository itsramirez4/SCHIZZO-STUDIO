/**
 * "Sharing" without a server: a palette's name + colors round-tripped through a compact,
 * copy-pasteable base64 code. There's no backend to host a share link against (same
 * infrastructure gap as real-time collaboration), so this is the honest local equivalent —
 * paste the code into a chat/doc, the other person pastes it back into "Importar código".
 */

interface PaletteCode {
  v: 1;
  n: string;
  c: string[];
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function encodePaletteCode(name: string, colors: string[]): string {
  const payload: PaletteCode = { v: 1, n: name, c: colors };
  return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
}

export function decodePaletteCode(code: string): { name: string; colors: string[] } | null {
  try {
    const json = decodeURIComponent(escape(atob(code.trim())));
    const payload = JSON.parse(json) as Partial<PaletteCode>;
    if (payload.v !== 1 || typeof payload.n !== 'string' || !Array.isArray(payload.c)) return null;
    if (payload.c.length === 0 || !payload.c.every((c) => typeof c === 'string' && HEX_RE.test(c))) return null;
    return { name: payload.n, colors: payload.c };
  } catch {
    return null;
  }
}
