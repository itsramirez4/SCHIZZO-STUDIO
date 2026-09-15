import { CloudFileMeta, CloudProviderModule, ProviderAppConfig, TokenSet } from '../cloudTypes';

const APP_FOLDER = '/schizzo';

async function parseTokenResponse(res: Response): Promise<TokenSet> {
  if (!res.ok) throw new Error(`Dropbox token error: HTTP ${res.status} ${await res.text()}`);
  const data = (await res.json()) as any;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in ?? 14400) * 1000,
  };
}

export const dropboxProvider: CloudProviderModule = {
  buildAuthorizeUrl(config, challenge, state, redirectUri) {
    const params = new URLSearchParams({
      client_id: config.clientId,
      response_type: 'code',
      code_challenge: challenge,
      code_challenge_method: 'S256',
      redirect_uri: redirectUri,
      state,
      token_access_type: 'offline', // ensures a refresh_token comes back
    });
    return `https://www.dropbox.com/oauth2/authorize?${params.toString()}`;
  },

  async exchangeCode(config, code, verifier, redirectUri) {
    const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        client_id: config.clientId,
        redirect_uri: redirectUri,
        code_verifier: verifier,
      }),
    });
    return parseTokenResponse(res);
  },

  async refreshToken(config, refreshToken) {
    const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: config.clientId }),
    });
    const fresh = await parseTokenResponse(res);
    return { ...fresh, refreshToken: fresh.refreshToken ?? refreshToken }; // refresh calls don't always return a new one
  },

  async uploadFile(accessToken, filename, content) {
    const res = await fetch('https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Dropbox-API-Arg': JSON.stringify({ path: `${APP_FOLDER}/${filename}`, mode: 'overwrite', mute: true }),
        'Content-Type': 'application/octet-stream',
      },
      body: content,
    });
    if (!res.ok) throw new Error(`Dropbox upload error: HTTP ${res.status} ${await res.text()}`);
  },

  async listFiles(accessToken, extensionFilter) {
    const res = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: APP_FOLDER }),
    });
    if (res.status === 409) return []; // path/not_found — the app folder doesn't exist yet
    if (!res.ok) throw new Error(`Dropbox list error: HTTP ${res.status} ${await res.text()}`);
    const data = (await res.json()) as any;
    return (data.entries as any[])
      .filter((e) => e['.tag'] === 'file' && e.name.endsWith(extensionFilter))
      .map((e) => ({ id: e.path_lower, name: e.name, size: e.size, modifiedAt: e.server_modified }));
  },

  async downloadFile(accessToken, fileId) {
    const res = await fetch('https://content.dropboxapi.com/2/files/download', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Dropbox-API-Arg': JSON.stringify({ path: fileId }) },
    });
    if (!res.ok) throw new Error(`Dropbox download error: HTTP ${res.status} ${await res.text()}`);
    return Buffer.from(await res.arrayBuffer());
  },

  async deleteFile(accessToken, fileId) {
    const res = await fetch('https://api.dropboxapi.com/2/files/delete_v2', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: fileId }),
    });
    if (!res.ok) throw new Error(`Dropbox delete error: HTTP ${res.status} ${await res.text()}`);
  },
};

export function dropboxConfigNotes(): { scopesNeeded: string; redirectNote: string } {
  return {
    scopesNeeded: 'files.content.write, files.content.read',
    redirectNote: 'Registrá exactamente esta redirect URI en la app de Dropbox (App Console → Settings → OAuth 2 → Redirect URIs).',
  };
}
