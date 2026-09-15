import { Project } from '@/types';
import { serializeProject, deserializeProject } from '@/services/file.service';
import { CloudProvider } from '@/types/cloudSync';
import { sanitizeFilename } from '@/utils/fileUtils';

function toBase64(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}
function fromBase64(b64: string): string {
  return decodeURIComponent(escape(atob(b64)));
}

export async function uploadProjectToCloud(provider: CloudProvider, project: Project): Promise<{ ok: boolean; error?: string }> {
  const json = JSON.stringify(serializeProject(project));
  const filename = `${sanitizeFilename(project.name)}.drawing`;
  return window.electronAPI.cloudUpload(provider, filename, toBase64(json));
}

export async function downloadProjectFromCloud(provider: CloudProvider, fileId: string): Promise<{ ok: boolean; error?: string; project?: Project }> {
  const result = await window.electronAPI.cloudDownload(provider, fileId);
  if (!result.ok || !result.base64Content) return { ok: false, error: result.error };
  const json = fromBase64(result.base64Content);
  const project = await deserializeProject(json);
  return { ok: true, project };
}
