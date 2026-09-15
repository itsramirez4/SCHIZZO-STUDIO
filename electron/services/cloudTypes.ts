export type CloudProvider = 'dropbox' | 'googleDrive' | 'oneDrive';

export interface ProviderAppConfig {
  clientId: string;
  clientSecret?: string; // Google's token endpoint expects one even for installed apps; Dropbox/OneDrive's PKCE flow doesn't need it
}

export interface CloudFileMeta {
  id: string; // provider-specific id/path used for download/delete
  name: string;
  size: number;
  modifiedAt: string; // ISO date
}

export interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // epoch ms
}

export interface CloudProviderModule {
  buildAuthorizeUrl(config: ProviderAppConfig, challenge: string, state: string, redirectUri: string): string;
  exchangeCode(config: ProviderAppConfig, code: string, verifier: string, redirectUri: string): Promise<TokenSet>;
  refreshToken(config: ProviderAppConfig, refreshToken: string): Promise<TokenSet>;
  uploadFile(accessToken: string, filename: string, content: Buffer): Promise<void>;
  listFiles(accessToken: string, extensionFilter: string): Promise<CloudFileMeta[]>;
  downloadFile(accessToken: string, fileId: string): Promise<Buffer>;
  deleteFile(accessToken: string, fileId: string): Promise<void>;
}
