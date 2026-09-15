import { ipcMain } from 'electron';
import { generatePkce, generateState } from '../services/pkce';
import { redirectUri, waitForOAuthRedirect } from '../services/oauthLoopback';
import { getAllProviderConfigs, getProviderConfig, setProviderConfig } from '../services/cloudConfig';
import { saveTokens, loadTokens, clearTokens } from '../services/secureTokenStore';
import { CloudProvider, CloudProviderModule, ProviderAppConfig } from '../services/cloudTypes';
import { dropboxProvider } from '../services/providers/dropbox';
import { googleDriveProvider } from '../services/providers/googleDrive';
import { oneDriveProvider } from '../services/providers/oneDrive';

const PROVIDERS: Record<CloudProvider, CloudProviderModule> = {
  dropbox: dropboxProvider,
  googleDrive: googleDriveProvider,
  oneDrive: oneDriveProvider,
};

/** Refreshes the stored access token if it's expired (or about to, within a minute) and persists
 * the refreshed set — every file operation below routes through this instead of assuming the
 * cached token is still good. */
async function ensureValidToken(provider: CloudProvider): Promise<string> {
  const tokens = loadTokens(provider);
  if (!tokens) throw new Error('No conectado');
  if (tokens.expiresAt > Date.now() + 60000) return tokens.accessToken;
  if (!tokens.refreshToken) throw new Error('Sesión expirada — reconectá esta cuenta');

  const config = getProviderConfig(provider);
  if (!config) throw new Error('Falta configurar el Client ID');
  const fresh = await PROVIDERS[provider].refreshToken(config, tokens.refreshToken);
  saveTokens(provider, fresh);
  return fresh.accessToken;
}

export function registerCloudSyncHandlers() {
  ipcMain.handle('cloudSync:getConfig', async () => {
    return getAllProviderConfigs();
  });

  ipcMain.handle('cloudSync:setConfig', async (_e, provider: CloudProvider, config: ProviderAppConfig) => {
    setProviderConfig(provider, config);
    return { ok: true };
  });

  ipcMain.handle('cloudSync:getStatus', async () => {
    const status: Partial<Record<CloudProvider, boolean>> = {};
    for (const provider of Object.keys(PROVIDERS) as CloudProvider[]) {
      status[provider] = !!loadTokens(provider);
    }
    return status;
  });

  ipcMain.handle('cloudSync:getRedirectUri', async () => {
    return redirectUri();
  });

  ipcMain.handle('cloudSync:connect', async (_e, provider: CloudProvider) => {
    const config = getProviderConfig(provider);
    if (!config || !config.clientId) return { ok: false, error: 'Falta configurar el Client ID de esta cuenta' };

    const { verifier, challenge } = generatePkce();
    const state = generateState();
    const authorizeUrl = PROVIDERS[provider].buildAuthorizeUrl(config, challenge, state, redirectUri());

    const redirectResult = await waitForOAuthRedirect(authorizeUrl, state);
    if ('error' in redirectResult) return { ok: false, error: redirectResult.error };

    try {
      const tokens = await PROVIDERS[provider].exchangeCode(config, redirectResult.code, verifier, redirectUri());
      saveTokens(provider, tokens);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Error desconocido' };
    }
  });

  ipcMain.handle('cloudSync:disconnect', async (_e, provider: CloudProvider) => {
    clearTokens(provider);
    return { ok: true };
  });

  ipcMain.handle('cloudSync:upload', async (_e, provider: CloudProvider, filename: string, base64Content: string) => {
    try {
      const accessToken = await ensureValidToken(provider);
      await PROVIDERS[provider].uploadFile(accessToken, filename, Buffer.from(base64Content, 'base64'));
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Error desconocido' };
    }
  });

  ipcMain.handle('cloudSync:list', async (_e, provider: CloudProvider, extensionFilter?: string) => {
    try {
      const accessToken = await ensureValidToken(provider);
      const files = await PROVIDERS[provider].listFiles(accessToken, extensionFilter ?? '.drawing');
      return { ok: true, files };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Error desconocido', files: [] };
    }
  });

  ipcMain.handle('cloudSync:download', async (_e, provider: CloudProvider, fileId: string) => {
    try {
      const accessToken = await ensureValidToken(provider);
      const buffer = await PROVIDERS[provider].downloadFile(accessToken, fileId);
      return { ok: true, base64Content: buffer.toString('base64') };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Error desconocido' };
    }
  });

  ipcMain.handle('cloudSync:delete', async (_e, provider: CloudProvider, fileId: string) => {
    try {
      const accessToken = await ensureValidToken(provider);
      await PROVIDERS[provider].deleteFile(accessToken, fileId);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Error desconocido' };
    }
  });
}
