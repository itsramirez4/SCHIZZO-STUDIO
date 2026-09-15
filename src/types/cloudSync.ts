export type CloudProvider = 'dropbox' | 'googleDrive' | 'oneDrive';

export const CLOUD_PROVIDER_LABELS: Record<CloudProvider, string> = {
  dropbox: 'Dropbox',
  googleDrive: 'Google Drive',
  oneDrive: 'OneDrive',
};

export interface ProviderAppConfig {
  clientId: string;
  clientSecret?: string;
}

export interface CloudFileMeta {
  id: string;
  name: string;
  size: number;
  modifiedAt: string;
}
