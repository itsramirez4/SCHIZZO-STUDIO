import fs from 'fs';
import path from 'path';

export interface DownloadedModel {
  modelJson: string;
  /** All weight shards, concatenated in manifest order. */
  weights: Buffer;
}

/**
 * Fetches a TensorFlow.js graph model (model.json + weight shards) once and caches it in `dir`,
 * so later runs work offline. Done in the main process because the renderer cannot read these
 * hosts (no CORS headers). The shard URLs are resolved relative to the model.json URL.
 */
export async function getCachedModel(dir: string, modelJsonUrl: string, query = ''): Promise<DownloadedModel> {
  fs.mkdirSync(dir, { recursive: true });
  const jsonPath = path.join(dir, 'model.json');

  if (fs.existsSync(jsonPath)) {
    try {
      const modelJson = fs.readFileSync(jsonPath, 'utf-8');
      const paths = shardPaths(modelJson);
      if (paths.every((p) => fs.existsSync(path.join(dir, p)))) {
        return { modelJson, weights: Buffer.concat(paths.map((p) => fs.readFileSync(path.join(dir, p)))) };
      }
    } catch {
      // Corrupt cache: fall through and download again.
    }
  }

  const jsonRes = await fetch(modelJsonUrl + query, { redirect: 'follow' });
  if (!jsonRes.ok) throw new Error(`No se pudo descargar el modelo (HTTP ${jsonRes.status})`);
  const modelJson = await jsonRes.text();
  // Shards live next to the model.json URL we were given, not next to wherever a redirect landed
  // (signed redirect targets answer 403 for the sibling files).
  const base = modelJsonUrl.replace(/model\.json$/, '');
  const paths = shardPaths(modelJson);
  const shards: Buffer[] = [];
  for (const p of paths) {
    const r = await fetch(base + p + query, { redirect: 'follow' });
    if (!r.ok) throw new Error(`No se pudo descargar ${p} (HTTP ${r.status})`);
    shards.push(Buffer.from(await r.arrayBuffer()));
  }
  // Write shards first and model.json last: its presence marks a complete cache.
  paths.forEach((p, i) => fs.writeFileSync(path.join(dir, p), shards[i]));
  fs.writeFileSync(jsonPath, modelJson, 'utf-8');
  return { modelJson, weights: Buffer.concat(shards) };
}

function shardPaths(modelJson: string): string[] {
  const j = JSON.parse(modelJson) as { weightsManifest?: { paths: string[] }[] };
  return (j.weightsManifest ?? []).flatMap((g) => g.paths);
}
