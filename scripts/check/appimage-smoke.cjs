// Real smoke test for the Linux AppImage: launches it, drives it over CDP and checks the same
// critical path as scripts/check-installer.cjs does for the Windows installer.
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('playwright-core');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function ok(cond, msg) {
  if (!cond) throw new Error(msg);
}

(async () => {
  const appImage = fs.readdirSync('release').find((f) => f.endsWith('.AppImage'));
  ok(appImage, 'no se encontró el AppImage en release/');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'schizzo-appimage-profile-'));
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(path.join('release', appImage), ['--remote-debugging-port=9901', `--user-data-dir=${profile}`, '--no-sandbox'], { env, stdio: 'ignore' });
  let browser;
  try {
    for (let i = 0; i < 60 && !browser; i++) {
      await sleep(500);
      try {
        browser = await chromium.connectOverCDP('http://127.0.0.1:9901');
      } catch {
        /* arrancando */
      }
    }
    ok(browser, 'el AppImage no arrancó (no se pudo conectar por CDP)');
    let page;
    for (let i = 0; i < 40 && !page; i++) {
      page = browser.contexts()[0]?.pages().find((p) => p.url().startsWith('file:'));
      if (!page) await sleep(250);
    }
    ok(page, 'la ventana del AppImage no apareció');
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
    await sleep(1500);
    const drawn = await ink();
    ok(drawn > 0, 'el pincel no dibujó en el AppImage');
    await page.keyboard.press('Control+z');
    await sleep(1500);
    ok((await ink()) === 0, 'deshacer no funcionó en el AppImage');
    await page.keyboard.press('Control+Shift+z');
    await sleep(1500);
    ok((await ink()) === drawn, 'rehacer no funcionó en el AppImage');

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
    console.log('OK: el AppImage arranca, dibuja, deshace, rehace y reproduce el proceso — sin errores.');
  } finally {
    await browser?.close().catch(() => {});
    child.kill();
    await sleep(500);
    try {
      fs.rmSync(profile, { recursive: true, force: true });
    } catch {
      /* perfil aún en uso */
    }
  }
})().catch((e) => {
  console.error('FAIL:', e.message);
  process.exit(1);
});
