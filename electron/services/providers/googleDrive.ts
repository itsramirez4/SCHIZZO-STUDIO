import { CloudFileMeta, CloudProviderModule, TokenSet } from '../cloudTypes';

// drive.file: the app can only see/manage files IT created, not the user's whole Drive — the
// least-privilege scope for this use case, and one that avoids Google's stricter "sensitive
// scope" verification review that full Drive access would require.
const SCOPE = 'https://www.googleapis.com/auth/drive.file';

async function parseTokenResponse(res: Response): Promise<TokenSet> {
  if (!res.ok) throw new Error(`Google token error: HTTP ${res.status} ${await res.text()}`);
  const data = (await res.json()) as any;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
}

/** Finds this app's file by name (drive.file scope means every result is already one this app
 * created — no folder scoping needed). Returns null if none exists yet. */
async function findFileByName(accessToken: string, filename: string): Promise<{ id: string } | null> {
  const q = encodeURIComponent(`name = '${filename.replace(/'/g, "\\'")}' and trashed = false`);
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Google Drive search error: HTTP ${res.status} ${await res.text()}`);
  const data = (await res.json()) as any;
  return data.files?.[0] ? { id: data.files[0].id } : null;
}

function multipartBody(metadata: object, content: Buffer, boundary: string): Buffer {
  const head = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`,
    'utf-8'
  );
  const tail = Buffer.from(`\r\n--${boundary}--`, 'utf-8');
  return Buffer.concat([head, content, tail]);
}

export const googleDriveProvider: CloudProviderModule = {
  buildAuthorizeUrl(config, challenge, state, redirectUri) {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPE,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state,
      access_type: 'offline',
      prompt: 'consent', // forces a refresh_token on every connect, not just the first ever grant
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  },

  async exchangeCode(config, code, verifier, redirectUri) {
    const body = new URLSearchParams({
      code,
      client_id: config.clientId,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: verifier,
    });
    if (config.clientSecret) body.set('client_secret', config.clientSecret);
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    return parseTokenResponse(res);
  },

  async refreshToken(config, refreshToken) {
    const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: config.clientId });
    if (config.clientSecret) body.set('client_secret', config.clientSecret);
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const fresh = await parseTokenResponse(res);
    return { ...fresh, refreshToken: fresh.refreshToken ?? refreshToken }; // Google often omits it on refresh
  },

  async uploadFile(accessToken, filename, content) {
    const existing = await findFileByName(accessToken, filename);
    const boundary = `schizzo-${Date.now()}`;
    const body = multipartBody({ name: filename }, content, boundary);
    const url = existing
      ? `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=multipart`
      : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    const res = await fetch(url, {
      method: existing ? 'PATCH' : 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    });
    if (!res.ok) throw new Error(`Google Drive upload error: HTTP ${res.status} ${await res.text()}`);
  },

  async listFiles(accessToken, extensionFilter): Promise<CloudFileMeta[]> {
    const q = encodeURIComponent(`name contains '${extensionFilter.replace(/'/g, "\\'")}' and trashed = false`);
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,size,modifiedTime)&orderBy=modifiedTime desc`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`Google Drive list error: HTTP ${res.status} ${await res.text()}`);
    const data = (await res.json()) as any;
    return (data.files as any[]).map((f) => ({ id: f.id, name: f.name, size: Number(f.size ?? 0), modifiedAt: f.modifiedTime }));
  },

  async downloadFile(accessToken, fileId) {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`Google Drive download error: HTTP ${res.status} ${await res.text()}`);
    return Buffer.from(await res.arrayBuffer());
  },

  async deleteFile(accessToken, fileId) {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok && res.status !== 404) throw new Error(`Google Drive delete error: HTTP ${res.status} ${await res.text()}`);
  },
};
