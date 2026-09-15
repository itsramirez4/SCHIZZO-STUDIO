import { CloudProvider } from '@/types/cloudSync';
import { WorkflowProfile } from '@/types/profiles';
import { sanitizeFilename } from '@/utils/fileUtils';

/** Distinct extension from `.drawing` project files so listing one kind never mixes in the
 * other — both live in the same per-app cloud folder. */
export const PROFILE_EXTENSION = '.schizzoprofile.json';

function toBase64(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}
function fromBase64(b64: string): string {
  return decodeURIComponent(escape(atob(b64)));
}

export async function uploadProfileToCloud(provider: CloudProvider, profile: WorkflowProfile): Promise<{ ok: boolean; error?: string }> {
  const json = JSON.stringify({ kind: 'schizzo-profile', v: 1, profile });
  const filename = `${sanitizeFilename(profile.name)}${PROFILE_EXTENSION}`;
  return window.electronAPI.cloudUpload(provider, filename, toBase64(json));
}

export async function listCloudProfiles(provider: CloudProvider) {
  return window.electronAPI.cloudList(provider, PROFILE_EXTENSION);
}

export async function downloadProfileJsonFromCloud(provider: CloudProvider, fileId: string): Promise<{ ok: boolean; error?: string; json?: string }> {
  const result = await window.electronAPI.cloudDownload(provider, fileId);
  if (!result.ok || !result.base64Content) return { ok: false, error: result.error };
  return { ok: true, json: fromBase64(result.base64Content) };
}

export async function deleteProfileFromCloud(provider: CloudProvider, fileId: string) {
  return window.electronAPI.cloudDelete(provider, fileId);
}
