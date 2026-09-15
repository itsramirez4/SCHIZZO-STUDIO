import { CloudFileMeta, CloudProviderModule, TokenSet } from '../cloudTypes';

// Files.ReadWrite.AppFolder scopes access to a special per-app folder only (OneDrive's
// equivalent of Google's drive.file) — the app never sees the rest of the user's OneDrive.
const SCOPE = 'Files.ReadWrite.AppFolder offline_access';
const APP_ROOT = 'https://graph.microsoft.com/v1.0/me/drive/special/approot';

// Microsoft Graph's "simple upload" endpoint (the one used below) only accepts files up to 4MB;
// anything larger needs a chunked "resumable upload session", which this round doesn't implement.
const SIMPLE_UPLOAD_LIMIT = 4 * 1024 * 1024;

async function parseTokenResponse(res: Response): Promise<TokenSet> {
  if (!res.ok) throw new Error(`OneDrive token error: HTTP ${res.status} ${await res.text()}`);
  const data = (await res.json()) as any;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
}

export const oneDriveProvider: CloudProviderModule = {
  buildAuthorizeUrl(config, challenge, state, redirectUri) {
    const params = new URLSearchParams({
      client_id: config.clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: SCOPE,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state,
    });
    // "common" accepts both personal Microsoft accounts and work/school accounts.
    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
  },

  async exchangeCode(config, code, verifier, redirectUri) {
    const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.clientId,
        scope: SCOPE,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code_verifier: verifier,
      }),
    });
    return parseTokenResponse(res);
  },

  async refreshToken(config, refreshToken) {
    const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: config.clientId, scope: SCOPE, refresh_token: refreshToken, grant_type: 'refresh_token' }),
    });
    const fresh = await parseTokenResponse(res);
    return { ...fresh, refreshToken: fresh.refreshToken ?? refreshToken };
  },

  async uploadFile(accessToken, filename, content) {
    if (content.byteLength > SIMPLE_UPLOAD_LIMIT) {
      throw new Error('El archivo supera los 4MB — OneDrive necesita una carga por partes que esta versión no implementa todavía.');
    }
    const res = await fetch(`${APP_ROOT}:/${encodeURIComponent(filename)}:/content`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/octet-stream' },
      body: content,
    });
    if (!res.ok) throw new Error(`OneDrive upload error: HTTP ${res.status} ${await res.text()}`);
  },

  async listFiles(accessToken, extensionFilter): Promise<CloudFileMeta[]> {
    const res = await fetch(`${APP_ROOT}/children?$select=id,name,size,lastModifiedDateTime`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`OneDrive list error: HTTP ${res.status} ${await res.text()}`);
    const data = (await res.json()) as any;
    return (data.value as any[])
      .filter((f) => f.name?.endsWith(extensionFilter))
      .map((f) => ({ id: f.name, name: f.name, size: f.size, modifiedAt: f.lastModifiedDateTime }));
  },

  async downloadFile(accessToken, fileId) {
    const res = await fetch(`${APP_ROOT}:/${encodeURIComponent(fileId)}:/content`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`OneDrive download error: HTTP ${res.status} ${await res.text()}`);
    return Buffer.from(await res.arrayBuffer());
  },

  async deleteFile(accessToken, fileId) {
    const res = await fetch(`${APP_ROOT}:/${encodeURIComponent(fileId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok && res.status !== 404) throw new Error(`OneDrive delete error: HTTP ${res.status} ${await res.text()}`);
  },
};
