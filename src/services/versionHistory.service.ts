import { Project } from '@/types';
import { IdbStore } from '@/utils/idbStore';
import { flattenLayers } from './layer.service';
import { serializeProject, deserializeProject } from './file.service';

/**
 * Named, restorable snapshots of the whole project (all layers, masks and settings), kept in
 * IndexedDB per project id. Independent of the undo stack: they survive closing the app, so you
 * can go back to "the version from Tuesday". Each version also stores its flattened image so two
 * versions can be compared without loading either into the editor.
 */

export interface VersionMeta {
  id: string;
  projectId: string;
  projectName: string;
  name: string;
  created: string;
  /** Made automatically (periodic / on save) rather than by the artist. */
  auto: boolean;
  width: number;
  height: number;
  thumb: string;
}

const store = new IdbStore('schizzo-versions');
const AUTO_KEEP = 20;

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function thumbnail(source: HTMLCanvasElement, max = 160): string {
  const s = Math.min(1, max / Math.max(source.width, source.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(source.width * s));
  c.height = Math.max(1, Math.round(source.height * s));
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(source, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.7);
}

export async function saveVersion(project: Project, opts: { name: string; auto?: boolean }): Promise<VersionMeta> {
  const flat = flattenLayers(project.layers, project.width, project.height);
  const meta: VersionMeta = {
    id: newId(),
    projectId: project.id,
    projectName: project.name,
    name: opts.name,
    created: new Date().toISOString(),
    auto: !!opts.auto,
    width: project.width,
    height: project.height,
    thumb: thumbnail(flat),
  };
  await store.set('data:' + meta.id, { json: JSON.stringify(serializeProject(project)), flat: flat.toDataURL('image/png') });
  await store.set('meta:' + meta.id, meta);
  if (opts.auto) await pruneAuto(project.id);
  return meta;
}

export async function listVersions(projectId: string): Promise<VersionMeta[]> {
  const keys = (await store.keys()).filter((k) => k.startsWith('meta:'));
  const metas = await Promise.all(keys.map((k) => store.get<VersionMeta>(k)));
  return metas.filter((m): m is VersionMeta => !!m && m.projectId === projectId).sort((a, b) => b.created.localeCompare(a.created));
}

export async function getVersionImage(id: string): Promise<string | null> {
  const data = await store.get<{ flat: string }>('data:' + id);
  return data?.flat ?? null;
}

export async function deleteVersion(id: string) {
  await store.delete('meta:' + id);
  await store.delete('data:' + id);
}

export async function renameVersion(id: string, name: string) {
  const meta = await store.get<VersionMeta>('meta:' + id);
  if (meta) await store.set('meta:' + id, { ...meta, name });
}

async function pruneAuto(projectId: string) {
  const autos = (await listVersions(projectId)).filter((v) => v.auto);
  for (const v of autos.slice(AUTO_KEEP)) await deleteVersion(v.id);
}

/** Rebuilds the full project stored in a version (pixels included). */
export async function loadVersionProject(id: string, filePath?: string): Promise<Project> {
  const data = await store.get<{ json: string }>('data:' + id);
  if (!data) throw new Error('La versión ya no existe');
  return deserializeProject(data.json, filePath);
}

// ---- session baseline: the project exactly as it was when it was opened this session

const baselines = new Map<string, { flat: string; created: string }>();

export function captureBaseline(project: Project) {
  if (baselines.has(project.id)) return;
  baselines.set(project.id, {
    flat: flattenLayers(project.layers, project.width, project.height).toDataURL('image/png'),
    created: new Date().toISOString(),
  });
}

export function getBaseline(projectId: string) {
  return baselines.get(projectId) ?? null;
}

/** Makes sure every project has a persistent "starting point" version to compare against later. */
export async function ensureInitialVersion(project: Project) {
  try {
    if ((await listVersions(project.id)).length === 0) await saveVersion(project, { name: 'Estado inicial', auto: false });
  } catch {
    // IndexedDB unavailable: versions simply won't be offered.
  }
}
