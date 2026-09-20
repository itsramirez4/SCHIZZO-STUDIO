import { app, ipcMain, safeStorage } from 'electron';
import fs from 'fs';
import path from 'path';

/**
 * Optional image generation through a provider the user chooses (a local Stable Diffusion server or an
 * OpenAI-compatible images API). It runs here, in the main process, so the API key never reaches the
 * renderer. Nothing happens unless the AI master switch is on (the renderer mirrors it here; until it
 * does, the default is OFF) and the user has configured a provider and pressed the generate button.
 */
let aiEnabled = false;

const keyPath = () => path.join(app.getPath('userData'), 'ai-provider-key.json');

function readKey(): string | null {
  try {
    const raw = JSON.parse(fs.readFileSync(keyPath(), 'utf-8')).key as string | undefined;
    if (!raw) return null;
    if (raw.startsWith('plain:')) return raw.slice(6);
    if (raw.startsWith('enc:')) return safeStorage.decryptString(Buffer.from(raw.slice(4), 'base64'));
  } catch { /* no key saved */ }
  return null;
}

function writeKey(key: string) {
  const v = safeStorage.isEncryptionAvailable() ? `enc:${safeStorage.encryptString(key).toString('base64')}` : `plain:${key}`;
  fs.writeFileSync(keyPath(), JSON.stringify({ key: v }), 'utf-8');
}

/** https for anything remote; plain http only for this machine. */
export function checkEndpoint(endpoint: string): URL {
  let u: URL;
  try { u = new URL(endpoint); } catch { throw new Error('La dirección del servicio no es válida.'); }
  const local = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(u.hostname);
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && local)) throw new Error('Las direcciones remotas deben usar https (http solo se admite en localhost).');
  return u;
}

export interface GenerateArgs {
  kind: 'local-sd' | 'openai-compatible';
  endpoint: string;
  model: string;
  prompt: string;
  negative?: string;
  width: number;
  height: number;
}

const snap = (n: number) => Math.max(256, Math.min(1024, Math.round(n / 64) * 64));

async function post(url: string, body: unknown, headers: Record<string, string>, method: 'POST' | 'GET' = 'POST') {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 180_000);
  try {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', ...headers }, ...(method === 'POST' ? { body: JSON.stringify(body) } : {}), signal: ctl.signal });
    const text = await res.text();
    if (!res.ok) throw new Error(`El servicio respondió ${res.status}: ${text.slice(0, 200)}`);
    return JSON.parse(text);
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new Error('El servicio tardó más de 3 minutos en responder.');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function generateImage(a: GenerateArgs): Promise<string> {
  if (!aiEnabled) throw new Error('La IA está desactivada.');
  if (!a.prompt.trim()) throw new Error('Escribe qué quieres generar.');
  const base = checkEndpoint(a.endpoint).toString().replace(/\/+$/, '');
  const w = snap(a.width);
  const h = snap(a.height);
  if (a.kind === 'local-sd') {
    const j = await post(`${base}/sdapi/v1/txt2img`, { prompt: a.prompt, negative_prompt: a.negative ?? '', width: w, height: h, steps: 24, ...(a.model ? { override_settings: { sd_model_checkpoint: a.model } } : {}) }, {});
    const b64 = j?.images?.[0];
    if (typeof b64 !== 'string') throw new Error('El servidor no devolvió ninguna imagen.');
    return `data:image/png;base64,${b64}`;
  }
  const key = readKey();
  const j = await post(`${base}/images/generations`, { model: a.model || undefined, prompt: a.prompt, n: 1, size: `${w}x${h}`, response_format: 'b64_json' }, key ? { Authorization: `Bearer ${key}` } : {});
  const item = j?.data?.[0];
  if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`;
  if (typeof item?.url === 'string' && item.url.startsWith('https://')) {
    const r = await fetch(item.url);
    if (!r.ok) throw new Error('No se pudo descargar la imagen generada.');
    const buf = Buffer.from(await r.arrayBuffer());
    return `data:${r.headers.get('content-type') ?? 'image/png'};base64,${buf.toString('base64')}`;
  }
  throw new Error('El servicio no devolvió ninguna imagen.');
}

const authHeader = (): Record<string, string> => {
  const key = readKey();
  return key ? { Authorization: `Bearer ${key}` } : {};
};

/** Reaches the service and lists the models it offers (so the user learns at once whether the settings work). */
export async function testConnection(a: { kind: GenerateArgs['kind']; endpoint: string }): Promise<string[]> {
  if (!aiEnabled) throw new Error('La IA está desactivada.');
  const base = checkEndpoint(a.endpoint).toString().replace(/\/+$/, '');
  if (a.kind === 'local-sd') {
    const j = await post(`${base}/sdapi/v1/sd-models`, null, {}, 'GET');
    return (Array.isArray(j) ? j : []).map((m: { title?: string; model_name?: string }) => m.title ?? m.model_name ?? '').filter(Boolean);
  }
  const j = await post(`${base}/models`, null, authHeader(), 'GET');
  return (Array.isArray(j?.data) ? j.data : []).map((m: { id?: string }) => m.id ?? '').filter(Boolean);
}

/**
 * Rewrites a free-form description into the plain keywords the offline pose/expression interpreter understands.
 * Only the user's own sentence is sent; the model's answer is treated as text (it is parsed by the same
 * deterministic interpreter, so it can never inject joint angles or anything else).
 */
export async function rewriteText(a: { endpoint: string; model: string; text: string; vocabulary: string; task: 'pose' | 'expression' }): Promise<string> {
  if (!aiEnabled) throw new Error('La IA está desactivada.');
  if (!a.text.trim()) throw new Error('Escribe una descripción.');
  const base = checkEndpoint(a.endpoint).toString().replace(/\/+$/, '');
  const system = `Reescribe la descripción del usuario como una frase corta en español que use SOLO palabras de este vocabulario (${a.task === 'pose' ? 'poses' : 'emociones'}): ${a.vocabulary}. Si algo no se puede expresar, omítelo. Responde solo con la frase, sin explicaciones.`;
  const j = await post(`${base}/chat/completions`, { model: a.model || undefined, temperature: 0, max_tokens: 80, messages: [{ role: 'system', content: system }, { role: 'user', content: a.text.slice(0, 500) }] }, authHeader());
  const out = j?.choices?.[0]?.message?.content;
  if (typeof out !== 'string' || !out.trim()) throw new Error('El servicio no devolvió texto.');
  return out.trim().slice(0, 300);
}

export function registerAiHandlers() {
  ipcMain.handle('ai:setEnabled', (_e, on: unknown) => {
    aiEnabled = on === true;
    return aiEnabled;
  });
  ipcMain.handle('ai:hasKey', () => readKey() !== null);
  ipcMain.handle('ai:setKey', (_e, key: unknown) => {
    if (typeof key !== 'string' || !key.trim()) {
      try { fs.rmSync(keyPath(), { force: true }); } catch { /* nothing to remove */ }
      return false;
    }
    writeKey(key.trim());
    return true;
  });
  ipcMain.handle('ai:testConnection', async (_e, a: { kind: GenerateArgs['kind']; endpoint: string }) => {
    try { return { ok: true, models: await testConnection(a) }; } catch (err) { return { ok: false, error: err instanceof Error ? err.message : String(err) }; }
  });
  ipcMain.handle('ai:rewriteText', async (_e, a: Parameters<typeof rewriteText>[0]) => {
    try { return { ok: true, text: await rewriteText(a) }; } catch (err) { return { ok: false, error: err instanceof Error ? err.message : String(err) }; }
  });
  ipcMain.handle('ai:generateImage', async (_e, args: GenerateArgs) => {
    try {
      return { ok: true, dataUrl: await generateImage(args) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}
