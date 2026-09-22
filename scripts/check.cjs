#!/usr/bin/env node
/**
 * Batería local de comprobaciones: abre la app real (build de producción) en Electron con un perfil
 * temporal, hace las operaciones críticas como lo haría una persona y comprueba el resultado.
 *
 *   npm run check                 -> compila y ejecuta todos los grupos
 *   npm run check -- historial    -> solo un grupo (historial, archivo, exportar, reproduccion, tipos, rendimiento, capas, filtros, seleccion, pixelart, comic, animacion, paneles, ia)
 *   node scripts/check.cjs --no-build   -> usa el dist/ que ya exista
 *
 * No toca tus proyectos ni tu configuración: usa una carpeta temporal y responde por su cuenta a los
 * diálogos de abrir/guardar.
 */
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const skipBuild = args.includes('--no-build');
const wanted = args.filter((a) => !a.startsWith('--'));

let chromium;
try {
  ({ chromium } = require('playwright-core'));
} catch {
  console.error('Falta playwright-core. Ejecuta: npm install');
  process.exit(2);
}

// ---------------------------------------------------------------------------------------------
// Infraestructura
// ---------------------------------------------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
let port = 9870;

class Check {
  constructor(group) {
    this.group = group;
  }
  async launch() {
    this.dir = fs.mkdtempSync(path.join(os.tmpdir(), 'schizzo-check-'));
    this.out = path.join(this.dir, 'out');
    fs.mkdirSync(this.out, { recursive: true });
    const env = { ...process.env, SCHIZZO_CHECK_DIR: this.dir };
    delete env.ELECTRON_RUN_AS_NODE;
    const electronBin = require(path.join(ROOT, 'node_modules', 'electron'));
    const p = port++;
    this.child = spawn(electronBin, [path.join(__dirname, 'check', 'electron-entry.cjs'), `--remote-debugging-port=${p}`, `--user-data-dir=${path.join(this.dir, 'profile')}`], { env, stdio: 'ignore', cwd: ROOT });
    let browser;
    for (let i = 0; i < 40 && !browser; i++) {
      await sleep(500);
      try {
        browser = await chromium.connectOverCDP(`http://127.0.0.1:${p}`);
      } catch {
        /* todavía arrancando */
      }
    }
    if (!browser) throw new Error('No se pudo conectar con Electron');
    this.browser = browser;
    for (let i = 0; i < 40 && !this.page; i++) {
      this.page = browser.contexts()[0]?.pages().find((pg) => pg.url().startsWith('file:'));
      if (!this.page) await sleep(250);
    }
    if (!this.page) throw new Error('La ventana de la app no apareció');
    this.errors = [];
    this.page.on('pageerror', (e) => this.errors.push('pageerror: ' + e.message));
    this.page.on('console', (m) => {
      if (m.type() === 'error' && !/Autofill|Electron Security|Failed to load resource/i.test(m.text())) this.errors.push('console: ' + m.text().slice(0, 200));
    });
    await this.page.reload();
    await sleep(1500);
  }
  async close() {
    await this.browser?.close().catch(() => {});
    this.child?.kill();
    await sleep(300);
    try {
      fs.rmSync(this.dir, { recursive: true, force: true });
    } catch {
      /* Windows puede tener el perfil bloqueado un instante */
    }
  }

  // --- acciones de usuario ---
  async newProject({ name = 'check', type = 'Dibujo digital', width = 1200, height = 800 } = {}) {
    const page = this.page;
    const dialogInput = page.getByRole('button', { name: 'Crear', exact: true });
    if (!(await dialogInput.isVisible().catch(() => false))) {
      const card = page.getByText('Nuevo proyecto', { exact: true }).first();
      if (await card.isVisible().catch(() => false)) await card.click();
      else await page.locator('button[title="Nuevo proyecto (Ctrl+N)"]').click();
      await dialogInput.waitFor({ state: 'visible', timeout: 5000 });
    }
    await page.locator('.fixed input:not([type=number])').first().fill(name);
    await page.locator('.fixed').getByRole('button', { name: type, exact: true }).click();
    const nums = page.locator('.fixed input[type=number]');
    await nums.nth(0).fill(String(width));
    await nums.nth(1).fill(String(height));
    await page.getByRole('button', { name: 'Crear', exact: true }).click();
    await page.locator('.overflow-auto.checkerboard canvas').first().waitFor({ state: 'attached', timeout: 10000 }).catch(() => {});
    await sleep(1200);
  }
  async addLayer() {
    await this.page.locator('button[title="Nueva capa"]').click();
    await sleep(250);
  }
  async pickBrush() {
    await this.page.locator('.overflow-auto.checkerboard').first().hover().catch(() => {});
    await this.page.keyboard.press('b');
  }
  /** Un trazo con pointer events reales sobre el lienzo, a 60 fps. `row` (0-1) mueve el trazo en vertical. */
  async stroke(row = 0.5, points = 40) {
    await this.page.evaluate(async ({ row, points }) => {
      const sr = document.querySelector('.overflow-auto.checkerboard').getBoundingClientRect();
      const el = document.elementFromPoint(sr.x + sr.width * 0.5, sr.y + sr.height * 0.5);
      const pt = (i) => ({ x: sr.x + sr.width * (0.25 + (0.5 * i) / points), y: sr.y + sr.height * (0.2 + 0.6 * row + 0.04 * Math.sin(i / 5)) });
      const o = (p, b = 1) => ({ bubbles: true, cancelable: true, clientX: p.x, clientY: p.y, pointerId: 7, isPrimary: true, button: 0, buttons: b, pressure: 0.5, pointerType: 'mouse' });
      el.dispatchEvent(new PointerEvent('pointerdown', o(pt(0))));
      for (let i = 1; i < points; i++) {
        await new Promise((r) => requestAnimationFrame(r));
        el.dispatchEvent(new PointerEvent('pointermove', o(pt(i))));
      }
      el.dispatchEvent(new PointerEvent('pointerup', o(pt(points), 0)));
    }, { row, points });
  }
  /** Huella de todo lo que hay dibujado (capas del lienzo), para comparar estados. */
  async signature() {
    return this.page.evaluate(() => {
      let h = 0x811c9dc5;
      let ink = 0;
      const cs = document.querySelectorAll('.overflow-auto.checkerboard canvas');
      cs.forEach((c) => {
        const g = c.getContext('2d');
        if (!g || !c.width) return;
        const d = g.getImageData(0, 0, c.width, c.height).data;
        for (let i = 0; i < d.length; i += 4 * 13) {
          if (d[i + 3] > 0) ink++;
          h = Math.imul(h ^ d[i] ^ (d[i + 3] << 8) ^ (i << 1), 16777619);
        }
      });
      return { hash: h >>> 0, ink, canvases: cs.length };
    });
  }
  async press(keys, wait = 1300) {
    await this.page.keyboard.press(keys);
    await sleep(wait);
  }
  setNextOpen(file) {
    fs.writeFileSync(path.join(this.dir, 'next-open.txt'), file);
  }
  outFile(name) {
    return path.join(this.out, name);
  }
  async waitForFile(name, ms = 8000) {
    const f = this.outFile(name);
    for (let t = 0; t < ms; t += 200) {
      if (fs.existsSync(f) && fs.statSync(f).size > 0) {
        await sleep(200);
        return f;
      }
      await sleep(200);
    }
    throw new Error(`No se generó el archivo ${name}`);
  }
  async openExport(format) {
    await this.page.locator('button[title="Exportar (Ctrl+E)"]').click();
    await sleep(600);
    await this.page.getByRole('button', { name: format, exact: true }).click();
  }
  async doExport(format, file) {
    await this.openExport(format);
    await this.page.getByRole('button', { name: 'Exportar', exact: true }).last().click();
    return this.waitForFile(file);
  }
}

function ok(cond, msg) {
  if (!cond) throw new Error(msg);
}
const same = (a, b, msg) => ok(a.hash === b.hash && a.ink === b.ink, `${msg} (esperado ink=${a.ink}/${a.hash}, obtenido ink=${b.ink}/${b.hash})`);
const differ = (a, b, msg) => ok(a.hash !== b.hash || a.ink !== b.ink, msg);

function pngSize(buf) {
  ok(buf.slice(1, 4).toString() === 'PNG', 'no es un PNG válido');
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

// ---------------------------------------------------------------------------------------------
// Grupos de pruebas
// ---------------------------------------------------------------------------------------------
const groups = {
  historial: {
    'deshacer y rehacer un trazo devuelve los mismos píxeles': async (c) => {
      await c.newProject();
      await c.pickBrush();
      const blank = await c.signature();
      await c.stroke(0.3);
      await sleep(900);
      const s1 = await c.signature();
      differ(blank, s1, 'el trazo no dejó tinta');
      await c.press('Control+z');
      same(blank, await c.signature(), 'deshacer no volvió al lienzo en blanco');
      await c.press('Control+Shift+z');
      same(s1, await c.signature(), 'rehacer no devolvió el trazo');
    },
    'varios trazos: deshacer todos y rehacer todos': async (c) => {
      await c.newProject();
      await c.pickBrush();
      const states = [await c.signature()];
      for (const row of [0.2, 0.5, 0.8]) {
        await c.stroke(row);
        await sleep(700);
        states.push(await c.signature());
      }
      for (let i = 2; i >= 0; i--) {
        await c.press('Control+z');
        same(states[i], await c.signature(), `al deshacer hasta el paso ${i}`);
      }
      for (let i = 1; i <= 3; i++) {
        await c.press('Control+Shift+z');
        same(states[i], await c.signature(), `al rehacer hasta el paso ${i}`);
      }
    },
    'deshacer justo después de soltar el trazo (codificación en curso)': async (c) => {
      await c.newProject({ width: 3000, height: 2000 });
      await c.pickBrush();
      await c.addLayer();
      await c.addLayer();
      const before = await c.signature();
      await c.stroke(0.5);
      await c.page.keyboard.press('Control+z'); // sin esperar
      await sleep(2000);
      same(before, await c.signature(), 'el deshacer inmediato dejó restos del trazo');
      await c.press('Control+Shift+z');
      differ(before, await c.signature(), 'rehacer tras un deshacer inmediato no restauró el trazo');
    },
    'crear y borrar capas se deshace': async (c) => {
      await c.newProject();
      const one = await c.signature();
      await c.addLayer();
      const two = await c.signature();
      ok(two.canvases > one.canvases, 'no apareció la capa nueva');
      await c.press('Control+z');
      ok((await c.signature()).canvases === one.canvases, 'deshacer no quitó la capa');
      await c.press('Control+Shift+z');
      ok((await c.signature()).canvases === two.canvases, 'rehacer no devolvió la capa');
    },
  },

  archivo: {
    'guardar y reabrir conserva capas y píxeles': async (c) => {
      await c.newProject({ name: 'guardado', width: 1600, height: 1000 });
      await c.pickBrush();
      await c.stroke(0.3);
      await c.addLayer();
      await c.stroke(0.7);
      await sleep(900);
      const before = await c.signature();
      await c.press('Control+s', 1500);
      const file = await c.waitForFile('proyecto.drawing');
      const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
      const layers = data.layers ?? data.project?.layers;
      ok(Array.isArray(layers) && layers.length === 2, `el archivo debería tener 2 capas y tiene ${layers?.length}`);
      ok(layers.every((l) => typeof l.dataUrl === 'string' && l.dataUrl.startsWith('data:image/png')), 'alguna capa se guardó sin píxeles');
      ok(layers.every((l) => typeof l.opacity === 'number' && l.blendMode), 'faltan opacidad o modo de mezcla');
      // Abrimos otro proyecto vacío y cargamos el archivo guardado.
      await c.newProject({ name: 'otro', width: 800, height: 600 });
      c.setNextOpen(file);
      await c.press('Control+o', 2500);
      const after = await c.signature();
      same(before, after, 'lo reabierto no coincide con lo guardado');
    },
    'guardar de nuevo sobre el mismo archivo no pide ruta y guarda los cambios': async (c) => {
      await c.newProject({ name: 'resguardado', width: 1200, height: 800 });
      await c.pickBrush();
      await c.stroke(0.4);
      await c.press('Control+s', 1500);
      const file = await c.waitForFile('proyecto.drawing');
      const size1 = fs.statSync(file).size;
      fs.unlinkSync(file); // si volviera a pedir ruta, el diálogo lo recrearía
      await c.stroke(0.7);
      await sleep(600);
      const inked = await c.signature();
      await c.press('Control+s', 1500);
      ok(fs.existsSync(file), 'no se volvió a guardar el archivo');
      ok(fs.statSync(file).size > size1 * 0.9, 'el archivo guardado parece incompleto');
      await c.newProject({ name: 'otro', width: 600, height: 400 });
      c.setNextOpen(file);
      await c.press('Control+o', 2500);
      same(inked, await c.signature(), 'el segundo guardado no contiene el segundo trazo');
    },
  },

  exportar: {
    'PNG, JPG, WebP y BMP salen con el tamaño y formato correctos': async (c) => {
      const W = 900;
      const H = 600;
      await c.newProject({ name: 'export', width: W, height: H });
      await c.pickBrush();
      await c.stroke(0.5);
      await sleep(800);
      const png = fs.readFileSync(await c.doExport('PNG', 'export.png'));
      const sz = pngSize(png);
      ok(sz.w === W && sz.h === H, `PNG de ${sz.w}×${sz.h}, se esperaba ${W}×${H}`);
      await sleep(800);
      const jpg = fs.readFileSync(await c.doExport('JPG', 'export.jpg'));
      ok(jpg[0] === 0xff && jpg[1] === 0xd8, 'el JPG no empieza con FFD8');
      await sleep(800);
      const webp = fs.readFileSync(await c.doExport('WebP', 'export.webp'));
      ok(webp.slice(0, 4).toString() === 'RIFF' && webp.slice(8, 12).toString() === 'WEBP', 'el WebP no tiene cabecera RIFF/WEBP');
      await sleep(800);
      const bmp = fs.readFileSync(await c.doExport('BMP', 'export.bmp'));
      ok(bmp.slice(0, 2).toString() === 'BM', 'el BMP no empieza con BM');
      ok(bmp.readInt32LE(18) === W && Math.abs(bmp.readInt32LE(22)) === H, `BMP de ${bmp.readInt32LE(18)}×${bmp.readInt32LE(22)}`);
    },
    'el PNG exportado contiene el dibujo (no sale en blanco)': async (c) => {
      await c.newProject({ name: 'blanco', width: 900, height: 600 });
      await c.pickBrush();
      const blank = fs.statSync(await c.doExport('PNG', 'blanco.png')).size;
      await sleep(800);
      await c.newProject({ name: 'tinta', width: 900, height: 600 });
      await c.pickBrush();
      await c.stroke(0.5, 60);
      await sleep(800);
      const inked = fs.statSync(await c.doExport('PNG', 'tinta.png')).size;
      ok(inked > blank * 1.2, `el PNG con trazo (${inked} B) no pesa más que el vacío (${blank} B)`);
    },
    'SVG y PDF se generan': async (c) => {
      await c.newProject({ name: 'vec', width: 600, height: 400 });
      await c.pickBrush();
      await c.stroke(0.5);
      await sleep(800);
      const svg = fs.readFileSync(await c.doExport('SVG', 'vec.svg'), 'utf-8');
      ok(/<svg[\s>]/.test(svg), 'el SVG no contiene <svg>');
      await sleep(800);
      const pdf = fs.readFileSync(await c.doExport('PDF', 'vec.pdf'));
      ok(pdf.slice(0, 4).toString() === '%PDF', 'el PDF no empieza con %PDF');
    },
  },

  reproduccion: {
    'cada paso queda registrado, en orden, y el último fotograma tiene el dibujo': async (c) => {
      await c.newProject({ name: 'replay', width: 1600, height: 1000 });
      await c.pickBrush();
      for (const row of [0.25, 0.5, 0.75]) {
        await c.stroke(row);
        await sleep(700);
      }
      await sleep(800);
      await c.page.locator('button[title="Historial"]').click();
      await c.page.getByTestId('open-replay').click();
      await c.page.getByTestId('replay-image').waitFor({ timeout: 8000 });
      const step = await c.page.getByTestId('replay-step').innerText();
      const m = step.match(/Paso (\d+) de (\d+)/);
      ok(m && Number(m[2]) >= 4, `se esperaban ≥4 pasos (creado + 3 trazos), hay: "${step}"`);
      const inkOf = () =>
        c.page.getByTestId('replay-image').evaluate(async (im) => {
          await im.decode();
          const cv = document.createElement('canvas');
          cv.width = im.naturalWidth;
          cv.height = im.naturalHeight;
          const g = cv.getContext('2d');
          g.drawImage(im, 0, 0);
          const d = g.getImageData(0, 0, cv.width, cv.height).data;
          let n = 0;
          for (let i = 0; i < d.length; i += 4) if (d[i] < 128) n++;
          return n;
        });
      const last = await inkOf();
      await c.page.getByTestId('replay-scrubber').fill('0');
      await sleep(400);
      const first = await inkOf();
      ok(first === 0, `el primer fotograma debería estar en blanco (píxeles oscuros: ${first})`);
      ok(last > 50, `el último fotograma debería tener el dibujo (píxeles oscuros: ${last})`);
      await c.page.getByTestId('replay-next').click();
      await sleep(300);
      const actions = await c.page.getByTestId('replay-action').innerText();
      ok(actions.length > 0, 'no se muestra el nombre del paso');
    },
  },

  tipos: {
    'los cuatro tipos de proyecto abren sin errores': async (c) => {
      for (const type of ['Dibujo digital', 'Pixel Art', 'Cómic / Manga', '3D']) {
        const before = c.errors.length;
        await c.newProject({ name: type, type, width: 800, height: 600 });
        await sleep(1500);
        const fresh = c.errors.slice(before);
        ok(fresh.length === 0, `errores al abrir "${type}": ${fresh.join(' | ')}`);
      }
    },
    'el pincel funciona en dibujo y pixel art': async (c) => {
      for (const type of ['Dibujo digital', 'Pixel Art']) {
        await c.newProject({ name: type, type, width: 400, height: 300 });
        await c.pickBrush();
        const blank = await c.signature();
        await c.stroke(0.5);
        await sleep(700);
        differ(blank, await c.signature(), `el pincel no dibujó en "${type}"`);
      }
    },
  },

  rendimiento: {
    'lienzo de 12 MP con 5 capas: trazos fluidos y sin bloqueo al soltar': async (c) => {
      await c.newProject({ name: 'grande', width: 4000, height: 3000 });
      for (let i = 1; i < 5; i++) await c.addLayer();
      await c.pickBrush();
      await c.stroke(0.5, 30); // calentamiento
      await sleep(1200);
      const r = await c.page.evaluate(async () => {
        const sr = document.querySelector('.overflow-auto.checkerboard').getBoundingClientRect();
        const el = document.elementFromPoint(sr.x + sr.width * 0.5, sr.y + sr.height * 0.5);
        const N = 180;
        const pt = (i) => ({ x: sr.x + sr.width * (0.2 + (0.6 * i) / N), y: sr.y + sr.height * (0.5 + 0.2 * Math.sin(i / 8)) });
        const o = (p, b = 1) => ({ bubbles: true, cancelable: true, clientX: p.x, clientY: p.y, pointerId: 7, isPrimary: true, button: 0, buttons: b, pressure: 0.5, pointerType: 'mouse' });
        const raf = () => new Promise((r) => requestAnimationFrame(r));
        const frames = [];
        const handler = [];
        let last = performance.now();
        el.dispatchEvent(new PointerEvent('pointerdown', o(pt(0))));
        for (let i = 1; i < N; i++) {
          await raf();
          const now = performance.now();
          frames.push(now - last);
          last = now;
          const t0 = performance.now();
          el.dispatchEvent(new PointerEvent('pointermove', o(pt(i))));
          handler.push(performance.now() - t0);
        }
        const t1 = performance.now();
        el.dispatchEvent(new PointerEvent('pointerup', o(pt(N), 0)));
        await raf();
        const stall = performance.now() - t1;
        const p95 = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length * 0.95)];
        return { frameP95: p95(frames), handlerP95: p95(handler), stall };
      });
      console.log(`      · fotograma p95 ${r.frameP95.toFixed(1)} ms · evento p95 ${r.handlerP95.toFixed(1)} ms · parada al soltar ${r.stall.toFixed(0)} ms`);
      ok(r.handlerP95 < 8, `cada movimiento del pincel tarda demasiado (p95 ${r.handlerP95.toFixed(1)} ms, límite 8)`);
      ok(r.frameP95 < 30, `el dibujo va a tirones (fotograma p95 ${r.frameP95.toFixed(1)} ms, límite 30)`);
      ok(r.stall < 300, `la interfaz se queda parada al soltar el trazo (${r.stall.toFixed(0)} ms, límite 300)`);
    },
  },
};

Object.assign(groups, require('./check/extra-groups.cjs')({ ok, sleep, fs }));

// ---------------------------------------------------------------------------------------------
// Ejecución
// ---------------------------------------------------------------------------------------------
(async () => {
  if (!skipBuild) {
    console.log('Compilando…');
    execSync('npm run build', { cwd: ROOT, stdio: 'ignore' });
  }
  if (!fs.existsSync(path.join(ROOT, 'dist', 'index.html')) || !fs.existsSync(path.join(ROOT, 'dist-electron', 'main.js'))) {
    console.error('No hay build (dist/ y dist-electron/). Ejecuta sin --no-build.');
    process.exit(2);
  }
  const names = Object.keys(groups).filter((g) => wanted.length === 0 || wanted.includes(g));
  if (names.length === 0) {
    console.error(`Grupo desconocido. Disponibles: ${Object.keys(groups).join(', ')}`);
    process.exit(2);
  }
  const started = Date.now();
  for (const group of names) {
    console.log(`\n${group}`);
    for (const [name, fn] of Object.entries(groups[group])) {
      const c = new Check(group);
      const t0 = Date.now();
      let error = null;
      try {
        await c.launch();
        await fn(c);
        if (c.errors.length) throw new Error('errores en la consola de la app: ' + c.errors.slice(0, 3).join(' | '));
      } catch (e) {
        error = e;
      } finally {
        await c.close();
      }
      const secs = ((Date.now() - t0) / 1000).toFixed(1);
      results.push({ group, name, error });
      console.log(`  ${error ? '✘' : '✔'} ${name} (${secs}s)`);
      if (error) console.log(`      → ${error.message}`);
    }
  }
  const failed = results.filter((r) => r.error);
  console.log(`\n${results.length - failed.length}/${results.length} comprobaciones correctas en ${((Date.now() - started) / 1000).toFixed(0)}s`);
  process.exit(failed.length ? 1 : 0);
})();
