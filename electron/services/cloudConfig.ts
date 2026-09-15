import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { CloudProvider, ProviderAppConfig } from './cloudTypes';

/** The Client ID (and, for Google, Client Secret) the user obtains by registering their own app
 * in each provider's developer console — required because a third-party desktop app can't ship
 * with credentials for accounts it doesn't control. Not encrypted like the tokens: a Client ID
 * for a PKCE public client isn't confidential by design (it's visible in the authorize URL
 * itself), so plain JSON is appropriate here. */
function configPath(): string {
  return path.join(app.getPath('userData'), 'cloud-config.json');
}

export function getAllProviderConfigs(): Partial<Record<CloudProvider, ProviderAppConfig>> {
  try {
    return JSON.parse(fs.readFileSync(configPath(), 'utf-8'));
  } catch {
    return {};
  }
}

export function getProviderConfig(provider: CloudProvider): ProviderAppConfig | null {
  return getAllProviderConfigs()[provider] ?? null;
}

export function setProviderConfig(provider: CloudProvider, config: ProviderAppConfig) {
  const all = getAllProviderConfigs();
  all[provider] = config;
  fs.writeFileSync(configPath(), JSON.stringify(all, null, 2), 'utf-8');
}
