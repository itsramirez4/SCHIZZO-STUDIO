#!/usr/bin/env node
/**
 * Comprueba los instaladores de Windows de verdad: instala en silencio en una carpeta temporal,
 * abre la app instalada y dibuja en ella, la desinstala y comprueba que no queda nada; después
 * hace lo mismo con la versión portable.
 *
 *   npm run check:installer               -> genera los instaladores (unos 2 min) y los prueba
 *   node scripts/check-installer.cjs --no-build   -> prueba los que ya haya en release/
 *
 * Solo Windows. No toca tus proyectos ni tu configuración (perfil temporal y carpeta de instalación
 * temporal); al terminar borra lo que instaló.
 */
const { spawn, spawnSync, execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

if (process.platform !== 'win32') {
  console.error('Este comprobador es solo para Windows (instalador NSIS y portable).');
  process.exit(2);
}

const ROOT = path.resolve(__dirname, '..');
const skipBuild = process.argv.includes('--no-build');
const { chromium } = require('playwright-core');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const version = require(path.join(ROOT, 'package.json')).version;
const RELEASE = path.join(ROOT, 'release');
const results = [];

function ok(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function step(name, fn) {
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
  return !error;
}

function killApp() {
  spawnSync('taskkill', ['/F', '/IM', 'SCHIZZO STUDIO.exe'], { stdio: 'ignore' });
  spawnSync('taskkill', ['/F', '/IM', 'SCHIZZO-STUDIO-Portable-' + version + '.exe'], { stdio: 'ignore' });
}

/** Abre la app (exe) con depuración remota y hace un recorrido corto: proyecto, trazo, deshacer, reproducción. */
async function smoke(exe, port) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'schizzo-inst-profile-'));
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(exe, [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`], { env, stdio: 'ignore', detached: false });
  let browser;
  try {
    for (let i = 0; i < 60 && !browser; i++) {
      await sleep(500);
      try {
        browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
      } catch {
        /* arrancando */
      }
    }
    ok(browser, 'la app no arrancó (no se pudo conectar)');
    let page;
    for (let i = 0; i < 40 && !page; i++) {
      page = browser.contexts()[0]?.pages().find((p) => p.url().startsWith('file:'));
      if (!page) await sleep(250);
    }
    ok(page, 'la ventana de la app no apareció');
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/Autofill|Electron Security|Failed to load resource/i.test(m.text())) errors.push(m.text().slice(0, 160));
    });
    await page.reload();
    await sleep(1500);
    ok(await page.getByText('Nuevo proyecto', { exact: true }).first().isVisible(), 'la pantalla de inicio no muestra "Nuevo proyecto"');

    await page.getByText('Nuevo proyecto', { exact: true }).first().click();
    await page.getByRole('button', { name: 'Crear', exact: true }).waitFor({ timeout: 5000 });
    const nums = page.locator('.fixed input[type=number]');
    await nums.nth(0).fill('1200');
    await nums.nth(1).fill('800');
    await page.getByRole('button', { name: 'Crear', exact: true }).click();
    await page.locator('.overflow-auto.checkerboard canvas').first().waitFor({ state: 'attached', timeout: 10000 });
    await sleep(1200);
    await page.locator('.overflow-auto.checkerboard').first().hover();
    await page.keyboard.press('b');

    const ink = () =>
      page.evaluate(() => {
        let n = 0;
        document.querySelectorAll('.overflow-auto.checkerboard canvas').forEach((c) => {
          const g = c.getContext('2d');
          if (!g || !c.width) return;
          const d = g.getImageData(0, 0, c.width, c.height).data;
          for (let i = 3; i < d.length; i += 4 * 13) if (d[i] > 0) n++;
        });
        return n;
      });
    ok((await ink()) === 0, 'el lienzo nuevo no está vacío');
    await page.evaluate(async () => {
      const sr = document.querySelector('.overflow-auto.checkerboard').getBoundingClientRect();
      const el = document.elementFromPoint(sr.x + sr.width * 0.5, sr.y + sr.height * 0.5);
      const o = (x, y, b = 1) => ({ bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 7, isPrimary: true, button: 0, buttons: b, pressure: 0.5, pointerType: 'mouse' });
      el.dispatchEvent(new PointerEvent('pointerdown', o(sr.x + 200, sr.y + 200)));
      for (let i = 1; i < 40; i++) {
        await new Promise((r) => requestAnimationFrame(r));
        el.dispatchEvent(new PointerEvent('pointermove', o(sr.x + 200 + i * 5, sr.y + 200 + i * 2)));
      }
      el.dispatchEvent(new PointerEvent('pointerup', o(sr.x + 400, sr.y + 280, 0)));
    });
    await sleep(1200);
    const drawn = await ink();
    ok(drawn > 0, 'el pincel no dibujó en la app instalada');
    await page.keyboard.press('Control+z');
    await sleep(1200);
    ok((await ink()) === 0, 'deshacer no funcionó en la app instalada');
    await page.keyboard.press('Control+Shift+z');
    await sleep(1200);
    ok((await ink()) === drawn, 'rehacer no funcionó en la app instalada');

    await page.locator('button[title="Historial"]').click();
    await page.getByTestId('open-replay').click();
    await page.getByTestId('replay-image').waitFor({ timeout: 8000 });
    const step = await page.getByTestId('replay-step').innerText();
    ok(/Paso \d+ de [2-9]/.test(step), `la reproducción del proceso no tiene pasos: "${step}"`);
    const size = await page.getByTestId('replay-image').evaluate(async (im) => {
      await im.decode();
      return [im.naturalWidth, im.naturalHeight];
    });
    ok(size[0] > 0, 'el fotograma de la reproducción no se decodifica');
    ok(errors.length === 0, `errores en la consola de la app: ${errors.slice(0, 3).join(' | ')}`);
  } finally {
    await browser?.close().catch(() => {});
    child.kill();
    killApp();
    await sleep(1500);
    try {
      fs.rmSync(profile, { recursive: true, force: true });
    } catch {
      /* perfil aún en uso */
    }
  }
}

(async () => {
  if (!skipBuild) {
    console.log('Generando instaladores (npm run package)…');
    fs.rmSync(RELEASE, { recursive: true, force: true });
    execSync('npm run package', { cwd: ROOT, stdio: 'ignore' });
  }
  const setup = path.join(RELEASE, `SCHIZZO-STUDIO-Setup-${version}.exe`);
  const portable = path.join(RELEASE, `SCHIZZO-STUDIO-Portable-${version}.exe`);
  if (!fs.existsSync(setup) || !fs.existsSync(portable)) {
    console.error(`Faltan los instaladores en ${RELEASE}. Ejecuta sin --no-build.`);
    process.exit(2);
  }
  killApp();
  const started = Date.now();

  console.log('\ninstalador (NSIS)');
  const installDir = path.join(os.tmpdir(), 'schizzo-install-check');
  fs.rmSync(installDir, { recursive: true, force: true });
  const exe = path.join(installDir, 'SCHIZZO STUDIO.exe');
  const uninstaller = path.join(installDir, 'Uninstall SCHIZZO STUDIO.exe');
  let installed = false;

  installed = await step('se instala en silencio', async () => {
    // /D debe ser el último argumento y sin comillas.
    const r = spawnSync(setup, ['/S', `/D=${installDir}`], { stdio: 'ignore', timeout: 180000 });
    ok(r.status === 0, `el instalador terminó con código ${r.status}`);
    for (let i = 0; i < 60 && !fs.existsSync(exe); i++) await sleep(500);
    ok(fs.existsSync(exe), 'no se creó SCHIZZO STUDIO.exe en la carpeta de instalación');
    ok(fs.existsSync(uninstaller), 'no se creó el desinstalador');
    ok(fs.existsSync(path.join(installDir, 'resources', 'app.asar')), 'falta resources/app.asar');
  });
  if (installed) {
    await step('la app instalada arranca, dibuja, deshace y reproduce', () => smoke(exe, 9890));
    await step('se desinstala y no queda nada', async () => {
      const r = spawnSync(uninstaller, ['/S', `_?=${installDir}`], { stdio: 'ignore', timeout: 180000 });
      ok(r.status === 0, `el desinstalador terminó con código ${r.status}`);
      await sleep(1500);
      ok(!fs.existsSync(exe), 'SCHIZZO STUDIO.exe sigue en la carpeta tras desinstalar');
      ok(!fs.existsSync(path.join(installDir, 'resources')), 'la carpeta resources sigue tras desinstalar');
      fs.rmSync(installDir, { recursive: true, force: true }); // con _?= el desinstalador no se borra a sí mismo
    });
  }

  console.log('\nportable');
  await step('la versión portable arranca, dibuja, deshace y reproduce', () => smoke(portable, 9891));

  const failed = results.filter((r) => r.error);
  console.log(`\n${results.length - failed.length}/${results.length} comprobaciones correctas en ${((Date.now() - started) / 1000).toFixed(0)}s`);
  process.exit(failed.length ? 1 : 0);
})();
