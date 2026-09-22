#!/usr/bin/env node
/**
 * Comprobación real de la detección de pose (MoveNet vía TensorFlow.js): descarga el modelo real
 * (~12 MB) de tfhub.dev la primera vez, lo guarda en caché y ejecuta la inferencia de verdad sobre
 * un dibujo de prueba — separada del resto de la batería porque, a diferencia de todo lo demás,
 * necesita conexión a internet la primera vez y tarda bastante más.
 *
 *   npm run check:pose                 -> compila y ejecuta la comprobación
 *   node scripts/check-pose.cjs --no-build   -> usa el dist/ que ya exista
 *
 * El modelo descargado se guarda en scripts/check/.pose-model-cache (fuera del repo, en
 * .gitignore) y se reutiliza entre ejecuciones, así que solo la primera vez necesita red.
 */
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

let chromium;
try {
  ({ chromium } = require('playwright-core'));
} catch {
  console.error('Falta playwright-core. Ejecuta: npm install');
  process.exit(2);
}

const ROOT = path.resolve(__dirname, '..');
const skipBuild = process.argv.includes('--no-build');
const CACHE_DIR = path.join(__dirname, 'check', '.pose-model-cache');
fs.mkdirSync(CACHE_DIR, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function ok(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function launch(port) {
  const env = { ...process.env, SCHIZZO_CHECK_DIR: fs.mkdtempSync(path.join(require('os').tmpdir(), 'schizzo-pose-')) };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(require(path.join(ROOT, 'node_modules', 'electron')), [path.join(__dirname, 'check', 'electron-entry.cjs'), `--remote-debugging-port=${port}`, `--user-data-dir=${CACHE_DIR}`], { env, stdio: 'ignore', cwd: ROOT });
  let browser;
  for (let i = 0; i < 40 && !browser; i++) {
    await sleep(500);
    try {
      browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
    } catch {
      /* arrancando */
    }
  }
  ok(browser, 'no se pudo conectar con Electron');
  let page;
  for (let i = 0; i < 40 && !page; i++) {
    page = browser.contexts()[0]?.pages().find((p) => p.url().startsWith('file:'));
    if (!page) await sleep(250);
  }
  ok(page, 'la ventana de la app no apareció');
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.evaluate(() => localStorage.setItem('schizzo:check', '1'));
  await page.reload();
  await sleep(1500);
  return { child, browser, page, errors };
}

/** A simple standing figure MoveNet has a reasonable shot at: a filled silhouette with a visible
 * head, torso, arms slightly apart from the body and separated legs (limbs overlapping the torso
 * or each other are exactly what confuses a pose model, real photos or not). */
async function drawTestFigure(page) {
  return page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 400;
    c.height = 600;
    const g = c.getContext('2d');
    g.fillStyle = '#dce6f0';
    g.fillRect(0, 0, 400, 600);
    g.fillStyle = '#3a3a3a';
    g.beginPath();
    g.arc(200, 90, 45, 0, Math.PI * 2); // head
    g.fill();
    g.fillRect(150, 140, 100, 190); // torso
    g.fillRect(70, 150, 45, 170); // left arm, away from torso
    g.fillRect(285, 150, 45, 170); // right arm, away from torso
    g.fillRect(155, 330, 40, 220); // left leg
    g.fillRect(205, 330, 40, 220); // right leg
    return c.toDataURL('image/png');
  });
}

(async () => {
  if (!skipBuild) {
    console.log('Compilando…');
    execSync('npm run build', { cwd: ROOT, stdio: 'ignore' });
  }
  const results = [];
  const step = async (name, fn) => {
    const t0 = Date.now();
    let error = null;
    try {
      await fn();
    } catch (e) {
      error = e;
    }
    results.push({ name, error });
    console.log(`  ${error ? '✘' : '✔'} ${name} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    if (error) console.log(`      → ${error.message}`);
  };

  console.log('\ndeteccion-pose');
  const { child, browser, page, errors } = await launch(9930);
  try {
    await step('con la IA desactivada, detectar pose se rechaza sin tocar la red', async () => {
      const requests = [];
      page.on('request', (r) => {
        if (/tfhub|googleapis|tensorflow/i.test(r.url())) requests.push(r.url());
      });
      await page.evaluate(() => window.__schizzo.ai.getState().setEnabled(false));
      await sleep(300);
      const dataUrl = await drawTestFigure(page);
      const r = await page.evaluate(async (dataUrl) => {
        const img = new Image();
        img.src = dataUrl;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        c.getContext('2d').drawImage(img, 0, 0);
        try {
          const pd = await window.__schizzo.loadPoseDetect();
          await pd.detectPose(c);
          return { threw: false };
        } catch (e) {
          return { threw: true, message: e.message };
        }
      }, dataUrl);
      ok(r.threw && /desactivada/i.test(r.message), `detectPose debería rechazar con la IA apagada, dio: ${JSON.stringify(r)}`);
      ok(requests.length === 0, `no debería haber tocado la red con la IA apagada: ${requests.slice(0, 2).join(', ')}`);
    });

    await step('con la IA activada, descarga (o reutiliza) el modelo real y detecta sin errores', async () => {
      await page.evaluate(() => window.__schizzo.ai.getState().setEnabled(true));
      await sleep(300);
      const dataUrl = await drawTestFigure(page);
      const t0 = Date.now();
      const r = await page.evaluate(async (dataUrl) => {
        const img = new Image();
        img.src = dataUrl;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        c.getContext('2d').drawImage(img, 0, 0);
        const pd = await window.__schizzo.loadPoseDetect();
        const reading = await pd.detectPose(c, '#dce6f0');
        return reading;
      }, dataUrl);
      const firstMs = Date.now() - t0;
      ok(r && r.body && typeof r.body.confidence === 'number', `la lectura no tiene la forma esperada: ${JSON.stringify(r).slice(0, 300)}`);
      // Either a confident reading with 14 landmarks, or a clear "couldn't tell" with a reason —
      // both are well-formed; a synthetic silhouette isn't guaranteed to read as confidently as a
      // real photo, so the hard requirement is "didn't crash and came back well-formed", not a
      // specific confidence bar.
      if (r.body.landmarks) {
        const keys = ['headTop', 'chin', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'wristL', 'wristR', 'hipL', 'hipR', 'kneeL', 'kneeR', 'ankleL', 'ankleR'];
        ok(keys.every((k) => r.body.landmarks[k] && Number.isFinite(r.body.landmarks[k].x)), 'faltan puntos en el resultado');
        console.log(`      · confianza ${r.body.confidence.toFixed(2)}, método: ${r.body.method ?? 'directo'}`);
      } else {
        ok(typeof r.body.reason === 'string' && r.body.reason.length > 0, 'sin puntos y sin motivo explicado');
        console.log(`      · no reconoció la figura de prueba (confianza ${r.body.confidence.toFixed(2)}) — puede pasar con una silueta sintética, no es en sí un fallo`);
      }
      console.log(`      · primera detección (con posible descarga del modelo): ${(firstMs / 1000).toFixed(1)}s`);

      const modelFiles = fs.existsSync(path.join(CACHE_DIR, 'models', 'movenet-thunder')) ? fs.readdirSync(path.join(CACHE_DIR, 'models', 'movenet-thunder')) : [];
      ok(modelFiles.length > 0, 'el modelo no quedó guardado en caché en disco');

      const t1 = Date.now();
      await page.evaluate(async (dataUrl) => {
        const img = new Image();
        img.src = dataUrl;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        c.getContext('2d').drawImage(img, 0, 0);
        const pd = await window.__schizzo.loadPoseDetect();
        await pd.detectPose(c, '#dce6f0');
      }, dataUrl);
      const secondMs = Date.now() - t1;
      console.log(`      · segunda detección (modelo ya en memoria): ${(secondMs / 1000).toFixed(1)}s`);
      ok(secondMs < firstMs + 2000, 'la segunda detección no debería tardar más que la primera');
    });

    ok(errors.length === 0, `errores en la consola de la app: ${errors.slice(0, 3).join(' | ')}`);
  } catch (e) {
    results.push({ name: 'infraestructura', error: e });
    console.log(`  ✘ infraestructura: ${e.message}`);
  } finally {
    await browser.close().catch(() => {});
    child.kill();
  }

  const failed = results.filter((r) => r.error);
  console.log(`\n${results.length - failed.length}/${results.length} comprobaciones correctas`);
  console.log(`(modelo en caché para la próxima vez: ${CACHE_DIR})`);
  process.exit(failed.length ? 1 : 0);
})();
