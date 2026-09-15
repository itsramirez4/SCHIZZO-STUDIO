import { app, safeStorage } from 'electron';
import fs from 'fs';
import path from 'path';
import { CloudProvider, TokenSet } from './cloudTypes';

function tokensPath(): string {
  return path.join(app.getPath('userData'), 'cloud-tokens.json');
}

function readAll(): Record<string, string> {
  try {
    return JSON.parse(fs.readFileSync(tokensPath(), 'utf-8'));
  } catch {
    return {};
  }
}

function writeAll(data: Record<string, string>) {
  fs.writeFileSync(tokensPath(), JSON.stringify(data), 'utf-8');
}

/** Tokens are encrypted at rest via Electron's safeStorage (Windows DPAPI / macOS Keychain /
 * Linux libsecret) — never written in plain text, unlike the Client ID config (not a secret for
 * a PKCE public client). Falls back to plain storage only if OS-level encryption genuinely isn't
 * available on this machine, which is disclosed rather than silently downgraded. */
export function saveTokens(provider: CloudProvider, tokens: TokenSet) {
  const all = readAll();
  const json = JSON.stringify(tokens);
  all[provider] = safeStorage.isEncryptionAvailable() ? `enc:${safeStorage.encryptString(json).toString('base64')}` : `plain:${json}`;
  writeAll(all);
}

export function loadTokens(provider: CloudProvider): TokenSet | null {
  const raw = readAll()[provider];
  if (!raw) return null;
  try {
    if (raw.startsWith('plain:')) return JSON.parse(raw.slice(6));
    if (raw.startsWith('enc:')) return JSON.parse(safeStorage.decryptString(Buffer.from(raw.slice(4), 'base64')));
    return null;
  } catch {
    return null;
  }
}

export function clearTokens(provider: CloudProvider) {
  const all = readAll();
  delete all[provider];
  writeAll(all);
}

export function isEncryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable();
}
