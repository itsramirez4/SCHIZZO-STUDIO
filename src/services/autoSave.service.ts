import { Project } from '@/types';
import { isElectron } from '@/utils/fileUtils';
import { serializeProject, deserializeProject } from './file.service';

export interface AutoSaveEntry {
  id: string;
  projectId: string;
  projectName: string;
  fileName: string;
  timestamp: string;
  size: number;
}

export async function writeAutoSave(project: Project): Promise<void> {
  if (!isElectron()) return; // no writable backup location in the browser build
  const json = JSON.stringify(serializeProject(project));
  await window.electronAPI.autosaveWrite(json, project.id, project.name);
}

export async function listAutoSaves(): Promise<AutoSaveEntry[]> {
  if (!isElectron()) return [];
  return window.electronAPI.autosaveList();
}

export async function restoreAutoSave(id: string): Promise<Project | null> {
  const result = await window.electronAPI.autosaveRead(id);
  if (result.canceled || !result.json) return null;
  // Restored as an unsaved project (no filePath) so it can never silently overwrite
  // the user's real .drawing file — they must explicitly "Guardar como" to keep it.
  const project = await deserializeProject(result.json);
  return { ...project, filePath: undefined };
}

export async function deleteAutoSave(id: string): Promise<void> {
  if (!isElectron()) return;
  await window.electronAPI.autosaveDelete(id);
}
