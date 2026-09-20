import { app, ipcMain } from 'electron';
import path from 'path';
import { getCachedModel } from '../services/modelDownload';

const MOVENET_THUNDER = 'https://tfhub.dev/google/tfjs-model/movenet/singlepose/thunder/4/model.json';

export function registerPoseModelHandlers() {
  ipcMain.handle('poseModel:get', async () => {
    try {
      const dir = path.join(app.getPath('userData'), 'models', 'movenet-thunder');
      const { modelJson, weights } = await getCachedModel(dir, MOVENET_THUNDER, '?tfjs-format=file');
      // A plain Uint8Array crosses the IPC boundary cheaply (structured clone).
      return { ok: true, modelJson, weights: new Uint8Array(weights.buffer, weights.byteOffset, weights.byteLength) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}
