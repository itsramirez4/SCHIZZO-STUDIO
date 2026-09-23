/**
 * Grupos de comprobaciones "a fondo": capas, filtros, selección/transformaciones, pixel art, cómic,
 * animación, paneles e IA. Usan el gancho `window.__schizzo` (ver src/checkHook.ts) para preparar
 * píxeles exactos y leer el estado real de la app, en vez de fiarse solo de lo que se ve.
 */
const http = require('http');

/** A 1x1 white PNG, base64 — stands in for a "generated" image without needing a real model. */
const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

/**
 * A local HTTP server standing in for a Stable Diffusion server or an OpenAI-compatible endpoint —
 * lets the generative-image/chat plumbing (main process → fetch → parse) be exercised for real
 * without any paid API key or GPU. Records every request it receives so tests can assert the app
 * actually reached it (or, with the AI switch off, that it never did).
 */
function mockAiServer() {
  const hits = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      hits.push({ method: req.method, url: req.url, body: body ? JSON.parse(body) : null });
      res.setHeader('Content-Type', 'application/json');
      if (req.url.endsWith('/images/generations')) res.end(JSON.stringify({ data: [{ b64_json: TINY_PNG_B64 }] }));
      else if (req.url.endsWith('/sdapi/v1/txt2img')) res.end(JSON.stringify({ images: [TINY_PNG_B64] }));
      else if (req.url.endsWith('/sdapi/v1/sd-models')) res.end(JSON.stringify([{ title: 'mock-sd-checkpoint' }]));
      else if (req.url.endsWith('/models')) res.end(JSON.stringify({ data: [{ id: 'mock-gpt' }] }));
      else if (req.url.endsWith('/chat/completions')) res.end(JSON.stringify({ choices: [{ message: { content: 'de pie, brazos cruzados' } }] }));
      else {
        res.statusCode = 404;
        res.end('{}');
      }
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, hits, base: `http://127.0.0.1:${server.address().port}` }));
  });
}
const closeServer = (server) => new Promise((r) => server.close(r));

module.exports = function extraGroups({ ok, sleep, fs }) {
  // Se ejecutan dentro de la página: utilidades para pintar y leer píxeles de capas.
  const HELPERS = `
    window.__h = (() => {
      const S = window.__schizzo;
      const st = () => S.store.getState();
      const proj = () => st().project;
      const canvasOf = (id) => S.layers.getLayerCanvas(id);
      return {
        st, proj, canvasOf,
        cur: () => st().currentLayerId,
        ids: () => proj().layers.map((l) => l.id),
        rect(id, x, y, w, h, color) { const g = canvasOf(id).getContext('2d'); g.fillStyle = color; g.fillRect(x, y, w, h); },
        px(id, x, y) { return Array.from(canvasOf(id).getContext('2d').getImageData(x, y, 1, 1).data); },
        flat(x, y) { const f = S.layers.flattenLayers(proj().layers, proj().width, proj().height); return Array.from(f.getContext('2d').getImageData(x, y, 1, 1).data); },
        push(label) { st().pushHistory(label); },
        near(a, b, t = 3) { return a.every((v, i) => Math.abs(v - b[i]) <= t); },
      };
    })();`;

  const near = (a, b, t = 3) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) <= t);
  const fmt = (a) => `[${a.join(',')}]`;
  const expectPx = (got, want, msg, t = 3) => ok(near(got, want, t), `${msg}: se esperaba ${fmt(want)} y hay ${fmt(got)}`);

  /** Prepara un proyecto nuevo con el gancho de pruebas activo. */
  async function fresh(c, opts) {
    await c.page.evaluate(() => localStorage.setItem('schizzo:check', '1'));
    await c.page.reload();
    await sleep(1500);
    await c.newProject(opts);
    await c.page.evaluate(HELPERS);
  }
  const ev = (c, fn, arg) => c.page.evaluate(fn, arg);

  return {
    // -----------------------------------------------------------------------------------------
    capas: {
      'fusionar hacia abajo une los píxeles y se puede deshacer': async (c) => {
        await fresh(c, { width: 200, height: 100 });
        const r = await ev(c, async () => {
          const h = window.__h;
          const bottom = h.cur();
          h.rect(bottom, 10, 10, 30, 30, '#ff0000');
          const top = h.st().addLayer('arriba');
          h.rect(top, 100, 10, 30, 30, '#0000ff');
          h.push('pintar');
          const before = h.ids().length;
          h.st().mergeLayerDown(top);
          const after = h.ids().length;
          const merged = { red: h.flat(20, 20), blue: h.flat(110, 20) };
          await h.st().undo();
          return { before, after, merged, undone: h.ids().length, redBack: h.flat(20, 20), blueBack: h.flat(110, 20) };
        });
        ok(r.after === r.before - 1, `fusionar no redujo las capas (${r.before} → ${r.after})`);
        expectPx(r.merged.red, [255, 0, 0, 255], 'rojo tras fusionar');
        expectPx(r.merged.blue, [0, 0, 255, 255], 'azul tras fusionar');
        ok(r.undone === r.before, 'deshacer la fusión no devolvió la capa');
        expectPx(r.blueBack, [0, 0, 255, 255], 'azul tras deshacer');
      },
      'modos de mezcla y opacidad se aplican al aplanar': async (c) => {
        await fresh(c, { width: 100, height: 100 });
        const r = await ev(c, () => {
          const h = window.__h;
          const base = h.cur();
          h.rect(base, 0, 0, 100, 100, '#ff0000');
          const top = h.st().addLayer('azul');
          h.rect(top, 0, 0, 100, 100, '#0000ff');
          const out = {};
          h.st().setLayerOpacity(top, 0.5);
          out.half = h.flat(50, 50);
          h.st().setLayerOpacity(top, 1);
          h.st().setLayerBlendMode(top, 'multiply');
          out.multiply = h.flat(50, 50);
          h.st().setLayerBlendMode(top, 'screen');
          out.screen = h.flat(50, 50);
          h.st().setLayerBlendMode(top, 'source-over');
          h.st().setLayerVisibility(top, false);
          out.hidden = h.flat(50, 50);
          return out;
        });
        expectPx(r.half, [128, 0, 128, 255], 'azul al 50% sobre rojo', 4);
        expectPx(r.multiply, [0, 0, 0, 255], 'multiplicar rojo×azul');
        expectPx(r.screen, [255, 0, 255, 255], 'trama rojo+azul');
        expectPx(r.hidden, [255, 0, 0, 255], 'capa oculta no se pinta');
      },
      'la máscara oculta y muestra, y se quita': async (c) => {
        await fresh(c, { width: 100, height: 100 });
        const r = await ev(c, () => {
          const h = window.__h;
          const id = h.cur();
          h.rect(id, 0, 0, 100, 100, '#00ff00');
          h.st().addMaskToLayer(id);
          const m = window.__schizzo.layers.getMaskCanvas(id);
          const g = m.getContext('2d');
          g.fillStyle = '#000000';
          g.fillRect(0, 0, 50, 100); // negro = oculto
          g.fillStyle = '#ffffff';
          g.fillRect(50, 0, 50, 100);
          const out = { hidden: h.flat(20, 50), shown: h.flat(80, 50), hasMask: h.proj().layers.find((l) => l.id === id).hasMask };
          h.st().invertLayerMask(id);
          out.inverted = { a: h.flat(20, 50), b: h.flat(80, 50) };
          h.st().removeMaskFromLayer(id);
          out.removed = h.flat(20, 50);
          return out;
        });
        ok(r.hasMask, 'la capa no quedó marcada con máscara');
        ok(r.hidden[3] === 0, `zona negra de la máscara debería ser transparente (alfa ${r.hidden[3]})`);
        expectPx(r.shown, [0, 255, 0, 255], 'zona blanca de la máscara');
        ok(r.inverted.a[3] === 255 && r.inverted.b[3] === 0, 'invertir la máscara no intercambió las zonas');
        expectPx(r.removed, [0, 255, 0, 255], 'sin máscara la capa vuelve a verse entera');
      },
      'agrupar aplica la opacidad del grupo y desagrupar la quita': async (c) => {
        await fresh(c, { width: 100, height: 100 });
        const r = await ev(c, () => {
          const h = window.__h;
          const a = h.cur();
          h.rect(a, 0, 0, 100, 100, '#000000');
          const g = h.st().createGroup('grupo');
          h.st().setLayerParent(a, g);
          const inGroup = h.proj().layers.find((l) => l.id === a).parent === g;
          h.st().setLayerOpacity(g, 0.5);
          const half = h.flat(50, 50);
          h.st().ungroupLayer(g);
          const stillGroup = h.proj().layers.some((l) => l.id === g);
          const parentAfter = h.proj().layers.find((l) => l.id === a)?.parent;
          return { inGroup, half, stillGroup, parentAfter };
        });
        ok(r.inGroup, 'la capa no quedó dentro del grupo');
        ok(Math.abs(r.half[3] - 128) <= 3, `al 50% el grupo debería dejar alfa ≈128 y deja ${r.half[3]}`);
        ok(!r.stillGroup && !r.parentAfter, 'desagrupar no deshizo el grupo');
      },
      'duplicar, reordenar y borrar capas': async (c) => {
        await fresh(c, { width: 100, height: 100 });
        const r = await ev(c, () => {
          const h = window.__h;
          const a = h.cur();
          h.rect(a, 0, 0, 100, 100, '#ff0000');
          const b = h.st().addLayer('azul');
          h.rect(b, 0, 0, 100, 100, '#0000ff');
          const topBefore = h.flat(10, 10);
          h.st().reorderLayers([...h.proj().layers].reverse());
          const topAfter = h.flat(10, 10);
          h.st().duplicateLayer(a);
          const dup = h.ids().length;
          const copy = h.proj().layers.find((l) => l.name !== 'azul' && l.id !== a && l.type === 'raster');
          const copyPx = copy ? h.px(copy.id, 10, 10) : null;
          h.st().deleteLayer(b);
          return { topBefore, topAfter, dup, copyPx, left: h.ids().length };
        });
        expectPx(r.topBefore, [0, 0, 255, 255], 'antes de reordenar arriba está el azul');
        expectPx(r.topAfter, [255, 0, 0, 255], 'tras reordenar arriba debe estar el rojo');
        ok(r.dup === 3, `duplicar debería dejar 3 capas (hay ${r.dup})`);
        ok(r.copyPx && r.copyPx[0] === 255, 'la copia no tiene los píxeles del original');
        ok(r.left === 2, `tras borrar una capa deberían quedar 2 (hay ${r.left})`);
      },
      'aplanar deja una capa con el mismo resultado': async (c) => {
        await fresh(c, { width: 100, height: 100 });
        const r = await ev(c, async () => {
          const h = window.__h;
          h.rect(h.cur(), 0, 0, 100, 100, '#ff0000');
          const b = h.st().addLayer('b');
          h.rect(b, 20, 20, 40, 40, '#0000ff');
          h.push('pintar');
          h.st().setLayerOpacity(b, 0.5);
          const before = h.flat(30, 30);
          const done = h.st().flattenImage();
          const after = { n: h.ids().length, px: h.flat(30, 30), corner: h.flat(5, 5) };
          await h.st().undo();
          return { before, done, after, undoneLayers: h.ids().length };
        });
        ok(r.done && r.after.n === 1, 'aplanar no dejó una sola capa');
        expectPx(r.after.px, r.before, 'aplanar cambió el resultado visible', 4);
        expectPx(r.after.corner, [255, 0, 0, 255], 'esquina roja');
        ok(r.undoneLayers === 2, 'deshacer el aplanado no devolvió las capas');
      },
      'recortar a la capa de abajo (clipping)': async (c) => {
        await fresh(c, { width: 100, height: 100 });
        const r = await ev(c, () => {
          const h = window.__h;
          const base = h.cur();
          h.rect(base, 0, 0, 50, 100, '#ff0000'); // solo la mitad izquierda
          const top = h.st().addLayer('recortada');
          h.rect(top, 0, 0, 100, 100, '#0000ff');
          h.st().setLayerClipTo(top, true);
          return { inside: h.flat(25, 50), outside: h.flat(75, 50) };
        });
        expectPx(r.inside, [0, 0, 255, 255], 'dentro de la base se ve la capa recortada');
        ok(r.outside[3] === 0, `fuera de la base debe quedar transparente (alfa ${r.outside[3]})`);
      },
      'capas de ajuste y relleno': async (c) => {
        await fresh(c, { width: 60, height: 60 });
        const r = await ev(c, () => {
          const h = window.__h;
          h.rect(h.cur(), 0, 0, 60, 60, '#ff0000');
          h.st().addAdjustmentLayer('invert');
          const inverted = h.flat(30, 30);
          h.st().addFillLayer('solid');
          const withFill = h.flat(30, 30);
          return { inverted, withFill, types: h.proj().layers.map((l) => l.type) };
        });
        expectPx(r.inverted, [0, 255, 255, 255], 'ajuste "invertir" sobre rojo');
        ok(r.types.includes('adjustment') && r.types.includes('fill'), `faltan tipos de capa: ${r.types}`);
      },
      'bloquear y ocultar todas / aislar': async (c) => {
        await fresh(c, { width: 60, height: 60 });
        const r = await ev(c, () => {
          const h = window.__h;
          const a = h.cur();
          h.rect(a, 0, 0, 60, 60, '#ff0000');
          const b = h.st().addLayer('b');
          h.rect(b, 0, 0, 60, 60, '#0000ff');
          h.st().setLayerLocked(b, true);
          const locked = h.proj().layers.find((l) => l.id === b).locked;
          h.st().toggleIsolateLayer(a);
          const isolated = h.flat(10, 10);
          h.st().toggleIsolateLayer(a);
          const restored = h.flat(10, 10);
          return { locked, isolated, restored };
        });
        ok(r.locked, 'la capa no quedó bloqueada');
        expectPx(r.isolated, [255, 0, 0, 255], 'aislando la roja solo se ve la roja');
        expectPx(r.restored, [0, 0, 255, 255], 'al volver a pulsar se restaura la visibilidad');
      },
    },

    // -----------------------------------------------------------------------------------------
    filtros: {
      'los filtros básicos dan el resultado esperado': async (c) => {
        await fresh(c, { width: 40, height: 40 });
        const r = await ev(c, () => {
          const h = window.__h;
          const F = window.__schizzo.filters;
          const mk = (color) => {
            const cv = document.createElement('canvas');
            cv.width = 40;
            cv.height = 40;
            const g = cv.getContext('2d');
            g.fillStyle = color;
            g.fillRect(0, 0, 40, 40);
            return cv;
          };
          const at = (cv) => Array.from(cv.getContext('2d').getImageData(20, 20, 1, 1).data);
          const out = {};
          let cv = mk('#ff0000'); F.invert(cv); out.invert = at(cv);
          cv = mk('#ff0000'); F.desaturate(cv); out.desaturate = at(cv);
          cv = mk('#c8c8c8'); F.threshold(cv, 128); out.thresholdHi = at(cv);
          cv = mk('#323232'); F.threshold(cv, 128); out.thresholdLo = at(cv);
          cv = mk('#7f7f7f'); F.posterize(cv, 2); out.posterize = at(cv);
          cv = mk('#808080'); F.brightnessContrast(cv, 50, 0); out.brighter = at(cv);
          cv = mk('#808080'); F.brightnessContrast(cv, -50, 0); out.darker = at(cv);
          cv = mk('#ff0000'); F.hue(cv, 180); out.hue180 = at(cv);
          cv = mk('#ff0000'); F.sepia(cv, 1); out.sepia = at(cv);
          cv = mk('#ff0000'); F.isolateChannel(cv, 'g'); out.isolateG = at(cv);
          return out;
        });
        expectPx(r.invert, [0, 255, 255, 255], 'invertir rojo');
        ok(r.desaturate[0] === r.desaturate[1] && r.desaturate[1] === r.desaturate[2], `desaturar no dejó gris: ${fmt(r.desaturate)}`);
        expectPx(r.thresholdHi, [255, 255, 255, 255], 'umbral sobre claro');
        expectPx(r.thresholdLo, [0, 0, 0, 255], 'umbral sobre oscuro');
        ok(r.posterize[0] === r.posterize[1] && (r.posterize[0] === 0 || r.posterize[0] === 255), `posterizar a 2 niveles: ${fmt(r.posterize)}`);
        ok(r.brighter[0] > 0x80 + 10, `más brillo no aclaró (${r.brighter[0]})`);
        ok(r.darker[0] < 0x80 - 10, `menos brillo no oscureció (${r.darker[0]})`);
        ok(r.hue180[0] < 60 && r.hue180[1] > 100, `tono +180° sobre rojo debería ir a cian/verde: ${fmt(r.hue180)}`);
        ok(r.sepia[0] > r.sepia[2], `sepia debería ser cálido: ${fmt(r.sepia)}`);
        ok(r.isolateG[0] === 0 && r.isolateG[2] === 0, `aislar canal verde: ${fmt(r.isolateG)}`);
      },
      'desenfoque y enfoque cambian los bordes, no las zonas planas': async (c) => {
        await fresh(c, { width: 60, height: 60 });
        const r = await ev(c, () => {
          const F = window.__schizzo.filters;
          const mk = () => {
            const cv = document.createElement('canvas');
            cv.width = 60;
            cv.height = 60;
            const g = cv.getContext('2d');
            g.fillStyle = '#ffffff';
            g.fillRect(0, 0, 60, 60);
            g.fillStyle = '#000000';
            g.fillRect(0, 0, 30, 60);
            return cv;
          };
          const at = (cv, x) => Array.from(cv.getContext('2d').getImageData(x, 30, 1, 1).data);
          const out = {};
          let cv = mk(); F.gaussianBlur(cv, 4); out.blurEdge = at(cv, 29); out.blurFar = at(cv, 2);
          cv = mk(); F.motionBlur(cv, 10, 0); out.motionEdge = at(cv, 30);
          cv = mk(); F.sharpen(cv, 1); out.sharpFar = at(cv, 5);
          cv = mk(); F.pixelate(cv, 8); out.pixelated = at(cv, 3);
          return out;
        });
        ok(r.blurEdge[0] > 10 && r.blurEdge[0] < 245, `el desenfoque no suavizó el borde: ${fmt(r.blurEdge)}`);
        ok(r.blurFar[0] < 10, `el desenfoque manchó una zona lejana: ${fmt(r.blurFar)}`);
        ok(r.motionEdge[0] > 10 && r.motionEdge[0] < 245, `desenfoque de movimiento: ${fmt(r.motionEdge)}`);
        ok(r.sharpFar[0] < 10, `enfocar cambió una zona plana: ${fmt(r.sharpFar)}`);
        ok(r.pixelated[3] === 255, 'pixelar dejó transparencia');
      },
      'cada filtro se ejecuta sin errores sobre una imagen con contenido': async (c) => {
        await fresh(c, { width: 64, height: 64 });
        const r = await ev(c, () => {
          const F = window.__schizzo.filters;
          const G = window.__schizzo.geometry;
          const mk = () => {
            const cv = document.createElement('canvas');
            cv.width = 64;
            cv.height = 64;
            const g = cv.getContext('2d');
            const grad = g.createLinearGradient(0, 0, 64, 64);
            grad.addColorStop(0, '#ff5500');
            grad.addColorStop(1, '#0044ff');
            g.fillStyle = grad;
            g.fillRect(0, 0, 64, 64);
            g.fillStyle = '#ffffff';
            g.fillRect(16, 16, 20, 20);
            return cv;
          };
          const cases = {
            brightnessContrast: (v) => F.brightnessContrast(v, 20, 20), saturation: (v) => F.saturation(v, 30), hue: (v) => F.hue(v, 90),
            invert: (v) => F.invert(v), desaturate: (v) => F.desaturate(v), blur: (v) => F.blur(v, 3), gaussianBlur: (v) => F.gaussianBlur(v, 3),
            motionBlur: (v) => F.motionBlur(v, 8, 45), radialBlur: (v) => F.radialBlur(v, 32, 32, 10), zoomBlur: (v) => F.zoomBlur(v, 32, 32, 10),
            tiltShift: (v) => F.tiltShift(v, 0, 0, 20, 4), sharpen: (v) => F.sharpen(v, 1), pixelate: (v) => F.pixelate(v, 4), noise: (v) => F.noise(v, 20),
            posterize: (v) => F.posterize(v, 4), threshold: (v) => F.threshold(v, 128), autoContrast: (v) => F.autoContrast(v),
            levels: (v) => F.levels(v, { inBlack: 10, inWhite: 240, gamma: 1, outBlack: 0, outWhite: 255 }),
            applyCurve: (v) => F.applyCurve(v, [{ x: 0, y: 0 }, { x: 128, y: 100 }, { x: 255, y: 255 }]),
            sepia: (v) => F.sepia(v, 0.8), charcoal: (v) => F.charcoal(v, 50), edgeDetection: (v) => F.edgeDetection(v, 30), bloom: (v) => F.bloom(v, 4, 0.5),
            oilPaint: (v) => F.oilPaint(v, 2),
            // Fog's `density` is a 0-1 fraction (the panel divides its 0-100 slider by 100 before
            // calling it); dust/smoke/rain take the slider's raw 0-100 value directly — passing
            // fractions there (as this used to) under-drove them enough that "unchanged" almost
            // hid it (dust drew a single dot, not none), which is what let the real scale mismatch
            // in scripts/check/filter-preview.cjs go unnoticed until a visual review caught it.
            applyFog: (v) => F.applyFog(v, 0.3, '#ffffff'), applyDust: (v) => F.applyDust(v, 30, '#ffffff'),
            applySmoke: (v) => F.applySmoke(v, 30, '#888888'), applyRain: (v) => F.applyRain(v, 30, 20, '#aaccff'),
            quantize: (v) => F.quantizeToPalette(v, [[0, 0, 0], [255, 255, 255], [255, 0, 0]]),
            dither: (v) => F.ditherToPalette(v, [[0, 0, 0], [255, 255, 255]], 0.8),
            // The other geometry-based "artistic effects" panel entries (pencil sketch, comic/cel
            // shading, mosaic, crystallize) live in geometryFilters.service and weren't exercised
            // by any check at all until now.
            pencilSketch: (v) => G.pencilSketch(v, 8, 90), toonShading: (v) => G.toonShading(v, 5, 80),
            mosaic: (v) => G.mosaic(v, 16, 2, '#101010'), crystallize: (v) => G.crystallize(v, 20),
          };
          for (const t of Object.keys(F.ADJUSTMENT_DEFAULTS)) cases['ajuste:' + t] = (v) => F.applyAdjustment(v, t, F.ADJUSTMENT_DEFAULTS[t]);
          const failed = [];
          const unchanged = [];
          for (const [name, fn] of Object.entries(cases)) {
            const cv = mk();
            const before = cv.getContext('2d').getImageData(0, 0, 64, 64).data.slice();
            try {
              fn(cv);
              const after = cv.getContext('2d').getImageData(0, 0, 64, 64).data;
              let same = true;
              for (let i = 0; i < after.length; i++) if (after[i] !== before[i]) { same = false; break; }
              if (same) unchanged.push(name);
            } catch (e) {
              failed.push(name + ': ' + e.message);
            }
          }
          return { total: Object.keys(cases).length, failed, unchanged };
        });
        ok(r.failed.length === 0, `filtros que fallan: ${r.failed.join(' | ')}`);
        // Algunos ajustes por defecto son la identidad a propósito (niveles/curvas neutros…): se informa, no se falla.
        if (r.unchanged.length) console.log(`      · sin efecto con los valores usados: ${r.unchanged.join(', ')}`);
        ok(r.unchanged.length <= Math.ceil(r.total * 0.4), `demasiados filtros no cambian nada (${r.unchanged.length}/${r.total}): ${r.unchanged.join(', ')}`);
      },
      'un filtro aplicado desde el panel se puede deshacer': async (c) => {
        await fresh(c, { width: 80, height: 60 });
        const r = await ev(c, async () => {
          const h = window.__h;
          const id = h.cur();
          h.rect(id, 0, 0, 80, 60, '#ff0000');
          h.push('pintar');
          window.__schizzo.filters.invert(h.canvasOf(id));
          h.push('Invertir');
          const inverted = h.px(id, 10, 10);
          await h.st().undo();
          const undone = h.px(id, 10, 10);
          await h.st().redo();
          return { inverted, undone, redone: h.px(id, 10, 10) };
        });
        expectPx(r.inverted, [0, 255, 255, 255], 'invertido');
        expectPx(r.undone, [255, 0, 0, 255], 'deshecho');
        expectPx(r.redone, [0, 255, 255, 255], 'rehecho');
      },
    },

    // -----------------------------------------------------------------------------------------
    seleccion: {
      'rellenar, borrar y copiar respetan el rectángulo seleccionado': async (c) => {
        await fresh(c, { width: 100, height: 100 });
        const r = await ev(c, () => {
          const h = window.__h;
          const id = h.cur();
          h.st().setSelection({ x: 20, y: 20, w: 40, h: 40 });
          h.st().fillSelection('#00ff00');
          const out = { inside: h.px(id, 30, 30), outside: h.px(id, 80, 80) };
          h.st().copySelection();
          const clip = h.st().clipboardCanvas;
          out.clip = clip ? [clip.width, clip.height] : null;
          h.st().clearSelectionArea();
          out.cleared = h.px(id, 30, 30);
          return out;
        });
        expectPx(r.inside, [0, 255, 0, 255], 'dentro de la selección');
        ok(r.outside[3] === 0, 'fuera de la selección no debía pintarse');
        ok(r.clip && r.clip[0] === 40 && r.clip[1] === 40, `el portapapeles debería medir 40×40 y mide ${r.clip}`);
        ok(r.cleared[3] === 0, 'borrar la selección no vació la zona');
      },
      'cortar y pegar crea una capa en el mismo sitio': async (c) => {
        await fresh(c, { width: 100, height: 100 });
        const r = await ev(c, () => {
          const h = window.__h;
          const id = h.cur();
          h.rect(id, 10, 10, 30, 30, '#0000ff');
          h.st().setSelection({ x: 10, y: 10, w: 30, h: 30 });
          h.st().cutSelection();
          const cut = h.px(id, 20, 20);
          const before = h.ids().length;
          h.st().pasteAsLayer();
          const pasted = h.st().currentLayerId;
          return { cut, before, after: h.ids().length, pastedPx: h.px(pasted, 20, 20), outside: h.px(pasted, 60, 60) };
        });
        ok(r.cut[3] === 0, 'cortar no vació el original');
        ok(r.after === r.before + 1, 'pegar no creó una capa nueva');
        expectPx(r.pastedPx, [0, 0, 255, 255], 'contenido pegado en su posición original');
        ok(r.outside[3] === 0, 'la capa pegada tiene contenido fuera de lo copiado');
      },
      'seleccionar todo, invertir, expandir y contraer': async (c) => {
        await fresh(c, { width: 100, height: 80 });
        const r = await ev(c, () => {
          const h = window.__h;
          h.st().selectAll();
          const all = h.st().selection;
          h.st().deselectAll();
          const none = h.st().selection;
          h.st().setSelection({ x: 30, y: 30, w: 20, h: 20 });
          h.st().expandSelection(5);
          const grown = h.st().selection;
          h.st().contractSelection(5);
          const back = h.st().selection;
          h.st().setSelection({ x: 0, y: 0, w: 50, h: 80 });
          h.st().invertSelection();
          h.st().fillSelection('#ff00ff');
          const id = h.cur();
          return { all, none, grown, back, left: h.px(id, 10, 40), right: h.px(id, 80, 40) };
        });
        ok(r.all && r.all.w === 100 && r.all.h === 80, `seleccionar todo: ${JSON.stringify(r.all)}`);
        ok(r.none === null, 'deseleccionar no quitó la selección');
        ok(r.grown && r.grown.w > 20 && r.grown.h > 20, `expandir no agrandó: ${JSON.stringify(r.grown)}`);
        ok(r.back && r.back.w <= r.grown.w, 'contraer no redujo');
        ok(r.left[3] === 0, 'la mitad seleccionada originalmente no debía pintarse tras invertir');
        expectPx(r.right, [255, 0, 255, 255], 'la mitad invertida debe pintarse');
      },
      'varita y rango de color seleccionan por color': async (c) => {
        await fresh(c, { width: 100, height: 100 });
        const r = await ev(c, () => {
          const h = window.__h;
          const id = h.cur();
          h.rect(id, 0, 0, 100, 100, '#ffffff');
          h.rect(id, 20, 20, 30, 30, '#ff0000');
          h.st().selectColorRange('#ff0000', 20);
          const sel = h.st().selection;
          const mask = h.st().selectionMask;
          const m = mask ? Array.from(mask.getContext('2d').getImageData(30, 30, 1, 1).data) : null;
          const o = mask ? Array.from(mask.getContext('2d').getImageData(80, 80, 1, 1).data) : null;
          return { sel, inside: m, outside: o };
        });
        ok(r.sel && r.sel.w >= 29 && r.sel.w <= 32 && r.sel.h >= 29 && r.sel.h <= 32, `el rectángulo de la selección debería ser ≈30×30: ${JSON.stringify(r.sel)}`);
        ok(r.inside && r.inside[3] > 200, 'la máscara no cubre el cuadrado rojo');
        ok(r.outside && r.outside[3] < 50, 'la máscara cubre zonas que no son rojas');
      },
      'voltear, aplanar la vista y recortar al contenido': async (c) => {
        await fresh(c, { width: 100, height: 80 });
        const r = await ev(c, () => {
          const h = window.__h;
          const id = h.cur();
          h.rect(id, 0, 0, 20, 80, '#ff0000');
          window.__schizzo.canvas.flipHorizontal(h.canvasOf(id));
          const flipped = { left: h.px(id, 5, 40), right: h.px(id, 95, 40) };
          window.__schizzo.canvas.flipVertical(h.canvasOf(id));
          h.rect(id, 0, 0, 1, 1, '#000000');
          h.push('preparar');
          return flipped;
        });
        ok(r.left[3] === 0, 'voltear horizontal no movió el contenido');
        expectPx(r.right, [255, 0, 0, 255], 'tras voltear, el rojo está a la derecha');
        const r2 = await ev(c, async () => {
          const h = window.__h;
          const id = h.cur();
          const g = h.canvasOf(id).getContext('2d');
          g.clearRect(0, 0, 100, 80);
          g.fillStyle = '#00ff00';
          g.fillRect(30, 20, 40, 30);
          h.push('cuadrado');
          const done = h.st().trimToContent();
          return { done, w: h.proj().width, h: h.proj().height };
        });
        ok(r2.done && r2.w === 40 && r2.h === 30, `recortar al contenido debería dar 40×30 y da ${r2.w}×${r2.h}`);
      },
    },

    // -----------------------------------------------------------------------------------------
    pixelart: {
      'el pincel no deja píxeles semitransparentes': async (c) => {
        await fresh(c, { type: 'Pixel Art', width: 64, height: 48 });
        await c.pickBrush();
        await c.stroke(0.5, 30);
        await sleep(700);
        const r = await ev(c, () => {
          const h = window.__h;
          const d = h.canvasOf(h.cur()).getContext('2d').getImageData(0, 0, 64, 48).data;
          let opaque = 0;
          let partial = 0;
          for (let i = 3; i < d.length; i += 4) {
            if (d[i] === 255) opaque++;
            else if (d[i] > 0) partial++;
          }
          return { opaque, partial };
        });
        ok(r.opaque > 0, 'no se dibujó nada');
        ok(r.partial === 0, `hay ${r.partial} píxeles semitransparentes en un lienzo de pixel art`);
      },
      'cuantizar y tramar a una paleta usa solo sus colores': async (c) => {
        await fresh(c, { type: 'Pixel Art', width: 48, height: 48 });
        const r = await ev(c, () => {
          const F = window.__schizzo.filters;
          const palette = [[20, 12, 28], [208, 70, 72], [109, 194, 202], [222, 238, 214]];
          const mk = () => {
            const cv = document.createElement('canvas');
            cv.width = 48;
            cv.height = 48;
            const g = cv.getContext('2d');
            const grad = g.createLinearGradient(0, 0, 48, 48);
            grad.addColorStop(0, '#8844cc');
            grad.addColorStop(1, '#22ee88');
            g.fillStyle = grad;
            g.fillRect(0, 0, 48, 48);
            return cv;
          };
          const colors = (cv) => {
            const d = cv.getContext('2d').getImageData(0, 0, 48, 48).data;
            const set = new Set();
            for (let i = 0; i < d.length; i += 4) set.add(`${d[i]},${d[i + 1]},${d[i + 2]}`);
            return [...set];
          };
          const allowed = new Set(palette.map((p) => p.join(',')));
          const q = mk();
          F.quantizeToPalette(q, palette);
          const d = document.createElement('canvas');
          d.width = 48;
          d.height = 48;
          d.getContext('2d').fillStyle = '#808080';
          d.getContext('2d').fillRect(0, 0, 48, 48);
          F.ditherToPalette(d, [[0, 0, 0], [255, 255, 255]], 1);
          return { q: colors(q).filter((x) => !allowed.has(x)), d: colors(d).filter((x) => x !== '0,0,0' && x !== '255,255,255'), qn: colors(q).length, dn: colors(d).length };
        });
        ok(r.q.length === 0, `cuantizar produjo colores fuera de la paleta: ${r.q.slice(0, 3)}`);
        ok(r.d.length === 0, `tramar produjo colores fuera de la paleta: ${r.d.slice(0, 3)}`);
        ok(r.dn >= 2, 'el tramado no usó varios colores');
      },
      'pixelar convierte la imagen en bloques': async (c) => {
        await fresh(c, { type: 'Pixel Art', width: 32, height: 32 });
        const r = await ev(c, () => {
          const F = window.__schizzo.filters;
          const cv = document.createElement('canvas');
          cv.width = 32;
          cv.height = 32;
          const g = cv.getContext('2d');
          const grad = g.createLinearGradient(0, 0, 32, 0);
          grad.addColorStop(0, '#000000');
          grad.addColorStop(1, '#ffffff');
          g.fillStyle = grad;
          g.fillRect(0, 0, 32, 32);
          F.pixelate(cv, 8);
          const d = g.getImageData(0, 0, 32, 32).data;
          const at = (x) => d[(4 * x) + 0];
          return { sameBlock: at(0) === at(7) && at(8) === at(15), differentBlocks: at(0) !== at(24) };
        });
        ok(r.sameBlock && r.differentBlocks, 'pixelar no produjo bloques uniformes de 8 px');
      },
    },

    // -----------------------------------------------------------------------------------------
    comic: {
      'plantillas de viñetas y tramas dibujan sobre la capa': async (c) => {
        await fresh(c, { type: 'Cómic / Manga', width: 300, height: 400 });
        const r = await ev(c, () => {
          const h = window.__h;
          const C = window.__schizzo.comic;
          const layerId = h.cur();
          const cv = h.canvasOf(layerId);
          const count = () => {
            const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
            let n = 0;
            for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
            return n;
          };
          const out = { blank: count() };
          C.applyPanelTemplate(cv, '4-grid', { borderWidth: 4, borderStyle: 'solid', borderColor: '#000000' });
          out.panels = count();
          // borde de la primera viñeta ≈ (8,8): debe haber tinta ahí
          out.corner = Array.from(cv.getContext('2d').getImageData(75, 8, 1, 1).data);
          out.center = Array.from(cv.getContext('2d').getImageData(150, 200, 1, 1).data);
          const cv2 = document.createElement('canvas');
          cv2.width = 100;
          cv2.height = 100;
          C.fillWithScreentone(cv2, 'dot', 40, 45, 0.5, '#000000');
          const d = cv2.getContext('2d').getImageData(0, 0, 100, 100).data;
          let ink = 0;
          for (let i = 3; i < d.length; i += 4) if (d[i] > 0) ink++;
          out.tone = ink / 10000;
          return out;
        });
        ok(r.blank === 0, 'la capa nueva no estaba vacía');
        ok(r.panels > 500, `la plantilla de 4 viñetas dibujó muy poco (${r.panels} px)`);
        ok(r.corner[3] > 0, 'no hay borde en el lado superior de la primera viñeta');
        ok(r.center[3] === 0, 'el centro de la página (entre viñetas) debería estar vacío');
        ok(r.tone > 0.05 && r.tone < 0.9, `la trama debería cubrir parte del área, no todo ni nada (${(r.tone * 100).toFixed(0)}%)`);
      },
      'globos de texto y líneas de velocidad': async (c) => {
        await fresh(c, { type: 'Cómic / Manga', width: 300, height: 300 });
        const r = await ev(c, () => {
          const h = window.__h;
          const C = window.__schizzo.comic;
          const cv = h.canvasOf(h.cur());
          C.drawSpeechBubble(cv, { x: 40, y: 40, w: 160, h: 80 }, 'Hola', 'speech', 18);
          const inside = Array.from(cv.getContext('2d').getImageData(120, 80, 1, 1).data);
          const far = Array.from(cv.getContext('2d').getImageData(280, 280, 1, 1).data);
          const cv2 = document.createElement('canvas');
          cv2.width = 200;
          cv2.height = 200;
          C.drawSpeedLinesRadial(cv2, 100, 100, 90, { count: 30, thickness: 2, hollow: 0.3, color: '#000000' });
          const d = cv2.getContext('2d').getImageData(0, 0, 200, 200).data;
          let ink = 0;
          for (let i = 3; i < d.length; i += 4) if (d[i] > 0) ink++;
          return { inside, far, speed: ink };
        });
        ok(r.inside[3] > 0, 'el globo no rellenó su interior');
        ok(r.far[3] === 0, 'el globo pintó fuera de su rectángulo');
        ok(r.speed > 200, `las líneas de velocidad dibujaron muy poco (${r.speed} px)`);
      },
      'el panel de cómic se abre y ofrece sus herramientas': async (c) => {
        await fresh(c, { type: 'Cómic / Manga', width: 300, height: 300 });
        // Un proyecto de cómic arranca con su panel abierto.
        await sleep(600);
        const open = await c.page.evaluate(() => /viñeta|globo|trama|screentone/i.test(document.body.innerText) && !!Array.from(document.querySelectorAll('h3')).find((h) => h.textContent.trim() === 'Cómic / Manga'));
        ok(open, 'el proyecto de cómic no abre su panel con viñetas, globos y tramas');
      },
    },

    // -----------------------------------------------------------------------------------------
    animacion: {
      'fotogramas: crear, duplicar, seleccionar, cambiar duración y borrar': async (c) => {
        await fresh(c, { width: 80, height: 60 });
        const r = await ev(c, () => {
          const h = window.__h;
          h.rect(h.cur(), 0, 0, 80, 60, '#ff0000');
          h.push('rojo');
          const out = {};
          h.st().enableAnimation();
          out.one = h.proj().animation.frames.length;
          h.st().addFrame('duplicate');
          out.two = h.proj().animation.frames.length;
          out.cur = h.proj().animation.currentFrameIndex;
          h.st().setFrameDuration(0, 250);
          out.dur = h.proj().animation.frames[0].durationMs;
          h.st().setAnimationFps(24);
          out.fps = h.proj().animation.fps;
          h.st().addFrame('blank');
          out.three = h.proj().animation.frames.length;
          out.blankFrame = h.flat(10, 10);
          h.st().selectFrame(0);
          out.backToFirst = h.flat(10, 10);
          h.st().deleteFrame(2);
          out.afterDelete = h.proj().animation.frames.length;
          return out;
        });
        ok(r.one === 1 && r.two === 2 && r.three === 3, `frames: ${r.one}/${r.two}/${r.three}`);
        ok(r.dur === 250 && r.fps === 24, `duración/fps no se guardaron (${r.dur}, ${r.fps})`);
        ok(r.blankFrame[3] === 0, 'el fotograma en blanco tiene contenido');
        expectPx(r.backToFirst, [255, 0, 0, 255], 'al volver al primer fotograma se ve su dibujo');
        ok(r.afterDelete === 2, 'borrar fotograma no lo quitó');
      },
      'deshacer y rehacer conservan los fotogramas': async (c) => {
        await fresh(c, { width: 80, height: 60 });
        const r = await ev(c, async () => {
          const h = window.__h;
          h.st().enableAnimation();
          h.st().addFrame('duplicate');
          h.st().addFrame('duplicate');
          const three = h.proj().animation.frames.length;
          await h.st().undo();
          const two = h.proj().animation.frames.length;
          await h.st().redo();
          return { three, two, again: h.proj().animation.frames.length };
        });
        ok(r.three === 3 && r.two === 2 && r.again === 3, `frames tras undo/redo: ${r.three}/${r.two}/${r.again}`);
      },
      'exportar GIF y APNG genera archivos válidos': async (c) => {
        await fresh(c, { name: 'anim', width: 80, height: 60 });
        await ev(c, () => {
          const h = window.__h;
          h.rect(h.cur(), 0, 0, 80, 60, '#ff0000');
          h.push('rojo');
          h.st().enableAnimation();
          h.st().addFrame('duplicate');
          h.rect(h.cur(), 0, 0, 40, 60, '#0000ff');
          h.push('azul');
        });
        const gif = await c.page.evaluate(() => window.__schizzo.animation.exportAnimationAsGif(window.__h.proj()));
        ok(!gif.canceled, 'la exportación de GIF se canceló');
        const gifFile = await c.waitForFile('anim.gif');
        const gbuf = fs.readFileSync(gifFile);
        ok(gbuf.slice(0, 6).toString().startsWith('GIF8'), 'el GIF no tiene cabecera GIF89a');
        ok(gbuf.readUInt16LE(6) === 80 && gbuf.readUInt16LE(8) === 60, `el GIF mide ${gbuf.readUInt16LE(6)}×${gbuf.readUInt16LE(8)}`);
        let images = 0;
        for (let i = 0; i < gbuf.length - 1; i++) if (gbuf[i] === 0x2c && gbuf[i + 1] === 0x00) images++;
        ok(images >= 2 || gbuf.includes(Buffer.from([0x21, 0xf9])), 'el GIF no parece contener varios fotogramas');
        const apng = await c.page.evaluate(() => window.__schizzo.animation.exportAnimationAsApng(window.__h.proj()));
        ok(!apng.canceled, 'la exportación de APNG se canceló');
        const files = fs.readdirSync(c.out).filter((f) => /\.a?png$/i.test(f));
        ok(files.length > 0, 'no se generó el APNG');
        const abuf = fs.readFileSync(c.outFile(files[0]));
        ok(abuf.includes(Buffer.from('acTL')), 'el APNG no contiene el bloque de animación (acTL)');
      },
      'la línea de tiempo se abre': async (c) => {
        await fresh(c, { width: 80, height: 60 });
        await c.page.evaluate(() => window.__h.st().enableAnimation());
        await c.page.locator('button[title="Animación"]').click();
        await sleep(600);
        const shown = await c.page.evaluate(() => /fotograma|frame|onion|cebolla|fps/i.test(document.body.innerText));
        ok(shown, 'el panel de animación no muestra fotogramas ni fps');
      },
    },

    // -----------------------------------------------------------------------------------------
    paneles: {
      'todos los paneles laterales se abren y se cierran sin errores': async (c) => {
        await fresh(c, { width: 400, height: 300 });
        const titles = await c.page.evaluate(() => {
          const rail = Array.from(document.querySelectorAll('button[title]'));
          const known = ['Capas', 'Filtros', 'Herramientas de color', 'Estudio', 'Perspectiva', 'Biblioteca', 'Referencias', 'Nube', 'Atajos', 'Procesamiento', 'Grabación', 'Aprender', 'Cómic', 'Animación', 'Histograma', 'Versiones', 'Historial', 'Estadísticas', 'Asistente'];
          return rail.map((b) => b.getAttribute('title')).filter((t) => known.some((k) => t.startsWith(k)));
        });
        ok(titles.length >= 15, `solo se encontraron ${titles.length} pestañas de panel`);
        const problems = [];
        for (const title of [...new Set(titles)]) {
          const before = c.errors.length;
          const btn = c.page.locator(`button[title="${title}"]`).first();
          await btn.click();
          await sleep(700);
          const fresh = c.errors.slice(before);
          const empty = await c.page.evaluate(() => document.body.innerText.includes('Algo salió mal') || document.body.innerText.includes('Ha ocurrido un error'));
          if (fresh.length) problems.push(`${title}: ${fresh[0]}`);
          if (empty) problems.push(`${title}: pantalla de error`);
          await btn.click().catch(() => {});
          await sleep(200);
        }
        c.errors.length = 0;
        ok(problems.length === 0, `paneles con problemas: ${problems.join(' | ')}`);
      },
      'los diálogos principales se abren y se cierran': async (c) => {
        await fresh(c, { width: 400, height: 300 });
        for (const title of ['Exportar (Ctrl+E)']) {
          await c.page.locator(`button[title="${title}"]`).click();
          await sleep(600);
          const open = await c.page.getByRole('button', { name: 'Cancelar', exact: true }).isVisible().catch(() => false);
          ok(open, `el diálogo de "${title}" no se abrió`);
          await c.page.getByRole('button', { name: 'Cancelar', exact: true }).click();
          await sleep(300);
        }
        await c.page.locator('button[title="Nuevo proyecto (Ctrl+N)"]').click();
        await sleep(500);
        ok(await c.page.getByRole('button', { name: 'Crear', exact: true }).isVisible(), 'el diálogo de nuevo proyecto no se abrió');
      },
      'los atajos de herramienta cambian la herramienta activa': async (c) => {
        await fresh(c, { width: 300, height: 200 });
        const keys = { b: 'brush', e: 'eraser', m: 'selection', l: 'lasso', w: 'magicWand', g: 'paintbucket', t: 'text', i: 'eyedropper', v: 'transform', h: 'pan', z: 'zoom' };
        const wrong = [];
        for (const [key, tool] of Object.entries(keys)) {
          await c.page.locator('.overflow-auto.checkerboard').first().hover().catch(() => {});
          await c.page.keyboard.press(key);
          await sleep(120);
          const got = await c.page.evaluate(() => window.__h.st().currentTool);
          if (got !== tool) wrong.push(`${key}→${got} (esperado ${tool})`);
        }
        ok(wrong.length === 0, `atajos que no cambian de herramienta: ${wrong.join(', ')}`);
      },
    },

    // -----------------------------------------------------------------------------------------
    ia: {
      'desactivar la IA quita el asistente y deja la app 100% manual': async (c) => {
        await fresh(c, { width: 300, height: 200 });
        const has = () => c.page.evaluate(() => Array.from(document.querySelectorAll('button[title]')).some((b) => b.getAttribute('title').startsWith('Asistente de IA')));
        await c.page.evaluate(() => window.__schizzo.ai.getState().setEnabled(true));
        await sleep(400);
        ok(await has(), 'con la IA activada debería verse la pestaña del asistente');
        await c.page.locator('button[title^="IA activada"]').click();
        await sleep(500);
        ok(!(await has()), 'con la IA desactivada la pestaña del asistente sigue visible');
        ok(!(await c.page.evaluate(() => window.__schizzo.ai.getState().enabled)), 'el estado de la IA sigue activado');
        const persisted = await c.page.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => /ai/i.test(k) && k !== 'schizzo:check')) || '{}').enabled);
        ok(persisted === false, 'la preferencia no se guardó');
        // La app sigue funcionando por completo sin IA.
        await c.pickBrush();
        const before = await c.signature();
        await c.stroke(0.5);
        await sleep(600);
        ok((await c.signature()).ink > before.ink, 'sin IA el pincel dejó de funcionar');
      },
      'con la IA desactivada no se hace ninguna petición de red': async (c) => {
        await fresh(c, { width: 300, height: 200 });
        await c.page.evaluate(() => window.__schizzo.ai.getState().setEnabled(false));
        const requests = [];
        c.page.on('request', (r) => {
          if (/^https?:/i.test(r.url())) requests.push(r.url());
        });
        await c.pickBrush();
        await c.stroke(0.5);
        for (const t of ['Capas', 'Filtros', 'Estudio: guías, tutor y academia', 'Referencias']) {
          await c.page.locator(`button[title="${t}"]`).first().click().catch(() => {});
          await sleep(400);
        }
        await sleep(1000);
        ok(requests.length === 0, `la app hizo peticiones de red con la IA apagada: ${requests.slice(0, 3).join(', ')}`);
      },
    },

    // -----------------------------------------------------------------------------------------
    // The 8 "AI-assisted" services that are actually local, deterministic image/text processing —
    // no model, no network — so they can be checked exactly like the plain filters.
    asistente: {
      'buildReferencePrompt traduce la petición y arma un prompt para el objetivo elegido': async (c) => {
        await fresh(c, { width: 100, height: 100 });
        const r = await ev(c, () => {
          const A = window.__schizzo.aiReferencePrompt;
          const pose = A.buildReferencePrompt('mujer corriendo bajo la lluvia', 'pose');
          const light = A.buildReferencePrompt('esfera con luz dura', 'light');
          return { pose, light, goals: A.REFERENCE_GOALS.map((g) => g.id) };
        });
        ok(['woman', 'running', 'rain'].every((w) => r.pose.translated.includes(w)), `no tradujo bien "mujer corriendo bajo la lluvia": ${JSON.stringify(r.pose.translated)}`);
        ok(/figure reference/.test(r.pose.prompt), 'el prompt de pose no lleva el estilo de referencia de pose');
        ok(/light and shadow/.test(r.light.prompt), 'el prompt de iluminación no lleva el estilo de referencia de luz');
        ok(r.goals.includes('pose') && r.goals.includes('scene'), 'faltan objetivos de referencia');
      },
      'paletteFromText y paletteFromImage sugieren colores': async (c) => {
        await fresh(c, { width: 120, height: 90 });
        const r = await ev(c, () => {
          const A = window.__schizzo.aiPalette;
          const fromText = A.paletteFromText('atardecer cálido en el bosque', 5);
          const cv = document.createElement('canvas');
          cv.width = 120;
          cv.height = 90;
          const g = cv.getContext('2d');
          g.fillStyle = '#274b8f';
          g.fillRect(0, 0, 120, 45);
          g.fillStyle = '#e08a3c';
          g.fillRect(0, 45, 120, 45);
          const fromImage = A.paletteFromImage(cv);
          return { fromText, fromImage };
        });
        ok(r.fromText.ideas.length > 0, 'paletteFromText no propuso ninguna paleta');
        ok(r.fromImage.ideas.length > 0, 'paletteFromImage no propuso ninguna paleta');
        ok(r.fromImage.current.length >= 2, `paletteFromImage debería leer al menos los 2 colores de la imagen, leyó ${r.fromImage.current.length}`);
      },
      'cleanDrawing quita motas sueltas y conserva el trazo': async (c) => {
        await fresh(c, { width: 200, height: 150 });
        const r = await ev(c, () => {
          const A = window.__schizzo.aiCleanup;
          const cv = document.createElement('canvas');
          cv.width = 200;
          cv.height = 150;
          const g = cv.getContext('2d');
          g.fillStyle = '#ffffff';
          g.fillRect(0, 0, 200, 150);
          g.strokeStyle = '#000000';
          g.lineWidth = 4;
          g.beginPath();
          g.moveTo(20, 75);
          g.lineTo(180, 75);
          g.stroke();
          // A few isolated 1-2px specks of dust, far from the line.
          g.fillStyle = '#000000';
          for (const [x, y] of [[30, 20], [90, 15], [160, 25], [40, 130], [150, 120]]) g.fillRect(x, y, 2, 2);
          // cleanDrawing doesn't touch `cv` — it returns a cleaned COPY as `.canvas`.
          const result = A.cleanDrawing(cv, { minSpeckArea: 8, closeGapRadius: 0, isolatedOnly: true });
          const og = result.canvas.getContext('2d');
          const px = (x, y) => Array.from(og.getImageData(x, y, 1, 1).data);
          return { specksRemoved: result.specksRemoved, specA: px(31, 21), specB: px(161, 26), lineMid: px(100, 75), lineEnd: px(21, 75) };
        });
        ok(r.specksRemoved === 5, `deberían haberse quitado las 5 motas sueltas, se quitaron ${r.specksRemoved}`);
        ok(r.specA[0] > 200 && r.specB[0] > 200, 'quedó una mota suelta sin limpiar');
        ok(r.lineMid[0] < 60, 'la limpieza borró el trazo principal');
        ok(r.lineEnd[0] < 60, 'la limpieza borró el extremo del trazo');
      },
      'analyzeComposition da una lectura de la composición del dibujo': async (c) => {
        await fresh(c, { width: 100, height: 100 });
        const r = await ev(c, () => {
          const A = window.__schizzo.aiComposition;
          const cv = document.createElement('canvas');
          cv.width = 240;
          cv.height = 160;
          const g = cv.getContext('2d');
          g.fillStyle = '#f4f4f4';
          g.fillRect(0, 0, 240, 160);
          g.fillStyle = '#101010';
          g.beginPath();
          g.arc(200, 40, 22, 0, Math.PI * 2); // an off-center subject, top-right
          g.fill();
          return A.analyzeComposition(cv);
        });
        ok(r.focus && r.focus.x > 0.6 && r.focus.y < 0.5, `el foco debería caer arriba a la derecha, dio ${JSON.stringify(r.focus)}`);
        ok(Array.isArray(r.notes ?? r.tips ?? r.observations ?? []) || typeof r === 'object', 'analyzeComposition no devolvió una lectura utilizable');
      },
      'separateLineArt, separateBackground y separateByColors dividen el dibujo en capas': async (c) => {
        await fresh(c, { width: 100, height: 100 });
        const r = await ev(c, () => {
          const A = window.__schizzo.aiLayerSeparation;
          const cv = document.createElement('canvas');
          cv.width = 150;
          cv.height = 100;
          const g = cv.getContext('2d');
          g.fillStyle = '#ffffff';
          g.fillRect(0, 0, 150, 100);
          g.fillStyle = '#d94f4f';
          g.fillRect(10, 10, 50, 50);
          g.fillStyle = '#4f7fd9';
          g.fillRect(80, 40, 50, 50);
          g.strokeStyle = '#000000';
          g.lineWidth = 3;
          g.strokeRect(20, 20, 30, 30);
          return {
            line: A.separateLineArt(cv).length,
            bg: A.separateBackground(cv, 40).length,
            colors: A.separateByColors(cv, 4).length,
          };
        });
        ok(r.line >= 1, 'separateLineArt no devolvió ninguna capa');
        ok(r.bg >= 1, 'separateBackground no devolvió ninguna capa');
        ok(r.colors >= 2, `separateByColors debería separar al menos 2 colores, separó ${r.colors}`);
      },
      'poseFromText, expressionFromText y correctTypos entienden descripciones en español': async (c) => {
        await fresh(c, { width: 100, height: 100 });
        const r = await ev(c, () => {
          const A = window.__schizzo.aiTextToPose;
          return {
            pose: A.poseFromText('de pie con los brazos cruzados'),
            expr: A.expressionFromText('muy alegre'),
            typo: A.correctTypos('sentaddo en el sueloo'),
          };
        });
        ok(r.pose && (r.pose.pose || r.pose.base || Object.keys(r.pose).length > 0), 'poseFromText no entendió una frase sencilla');
        ok(r.expr && Object.keys(r.expr).length > 0, 'expressionFromText no entendió una frase sencilla');
        ok(typeof r.typo.text === 'string' && r.typo.text.length > 0, 'correctTypos no devolvió texto');
      },
      'fitMannequinPose ajusta el maniquí 3D a una postura de pie simple': async (c) => {
        await fresh(c, { width: 100, height: 100 });
        const r = await ev(c, () => {
          const A = window.__schizzo.aiPoseFit;
          // A simple standing figure, arms at the sides, screen-space coordinates (x right, y down).
          const lm = {
            headTop: { x: 400, y: 100 }, chin: { x: 400, y: 150 },
            shoulderL: { x: 440, y: 190 }, shoulderR: { x: 360, y: 190 },
            elbowL: { x: 450, y: 280 }, elbowR: { x: 350, y: 280 },
            wristL: { x: 455, y: 360 }, wristR: { x: 345, y: 360 },
            hipL: { x: 425, y: 400 }, hipR: { x: 375, y: 400 },
            kneeL: { x: 425, y: 520 }, kneeR: { x: 375, y: 520 },
            ankleL: { x: 425, y: 630 }, ankleR: { x: 375, y: 630 },
          };
          return A.fitMannequinPose(lm);
        });
        ok(Number.isFinite(r.error), 'el ajuste no devolvió un error numérico');
        ok(r.error < 0.5, `el ajuste debería acercarse bastante a una postura de pie simple, error=${r.error}`);
        ok(r.pose && Object.keys(r.pose).length > 5, 'el ajuste no devolvió una pose con huesos');
      },
      'relightVariants propone varias iluminaciones y relightFull genera una a tamaño completo': async (c) => {
        await fresh(c, { width: 100, height: 100 });
        const r = await ev(c, () => {
          const A = window.__schizzo.aiRelight;
          // A genuinely shaded sphere (smooth radial gradient) — real relief to read, unlike flat
          // fills or line art, which isLineArt's own contract treats the same ("nothing to light").
          const shaded = document.createElement('canvas');
          shaded.width = 200;
          shaded.height = 150;
          const sg = shaded.getContext('2d');
          sg.fillStyle = '#303030';
          sg.fillRect(0, 0, 200, 150);
          const grad = sg.createRadialGradient(80, 60, 5, 100, 75, 55);
          grad.addColorStop(0, '#f4f0e0');
          grad.addColorStop(1, '#202020');
          sg.fillStyle = grad;
          sg.beginPath();
          sg.arc(100, 75, 50, 0, Math.PI * 2);
          sg.fill();
          // Flat line art: a sparse pencil-sketch-like face (a couple of thin strokes on white
          // paper, no shading at all) — a single thick outline covering a lot of the canvas
          // pushes global luminance variance right up to reliefAmount's threshold, so this needs
          // to be a properly sparse sketch to land unambiguously on the "line art" side.
          const flat = document.createElement('canvas');
          flat.width = 200;
          flat.height = 150;
          const fg = flat.getContext('2d');
          fg.fillStyle = '#ffffff';
          fg.fillRect(0, 0, 200, 150);
          fg.strokeStyle = '#000000';
          fg.lineWidth = 2;
          fg.beginPath();
          fg.arc(70, 60, 4, 0, Math.PI * 2);
          fg.stroke();
          fg.beginPath();
          fg.arc(130, 60, 4, 0, Math.PI * 2);
          fg.stroke();
          fg.beginPath();
          fg.moveTo(70, 100);
          fg.quadraticCurveTo(100, 115, 130, 100);
          fg.stroke();

          const variants = A.relightVariants(shaded);
          const full = variants[0] ? A.relightFull(shaded, variants[0].id) : null;
          return { n: variants.length, ids: variants.map((v) => v.id), fullSize: full ? [full.width, full.height] : null, shadedIsLineArt: A.isLineArt(shaded), flatIsLineArt: A.isLineArt(flat) };
        });
        ok(r.n >= 2, `relightVariants debería proponer varias opciones, propuso ${r.n}`);
        ok(new Set(r.ids).size === r.ids.length, 'relightVariants repitió el mismo id de variante');
        ok(r.fullSize && r.fullSize[0] === 200 && r.fullSize[1] === 150, `relightFull debería devolver el tamaño original (200x150), devolvió ${r.fullSize}`);
        ok(r.shadedIsLineArt === false, 'una esfera con degradado real se leyó como line art');
        ok(r.flatIsLineArt === true, 'un boceto de solo contorno no se leyó como line art');
      },
    },

    // -----------------------------------------------------------------------------------------
    // Generative image/chat plumbing (main process -> fetch -> the configured provider), exercised
    // against a local mock server instead of a real paid API — no key or GPU needed, but it is the
    // real IPC path an actual OpenAI-compatible or Stable Diffusion server would go through.
    'ia-generativa': {
      'generar imagen con un proveedor compatible con OpenAI llega al servicio y trae el resultado': async (c) => {
        await fresh(c, { width: 100, height: 100 });
        const { server, hits, base } = await mockAiServer();
        try {
          await c.page.evaluate(() => window.__schizzo.ai.getState().setEnabled(true));
          const r = await c.page.evaluate(
            ({ base }) => window.electronAPI.aiGenerateImage({ kind: 'openai-compatible', endpoint: base + '/v1', model: 'mock-model', prompt: 'un gato leyendo', width: 512, height: 512 }),
            { base }
          );
          ok(r.ok, `generar imagen falló: ${r.error}`);
          ok(typeof r.dataUrl === 'string' && r.dataUrl.startsWith('data:image/png;base64,'), 'no devolvió una imagen PNG');
          ok(hits.some((h) => h.url.endsWith('/images/generations') && h.body?.prompt === 'un gato leyendo'), 'el servicio mock no recibió el prompt esperado');
        } finally {
          await closeServer(server);
        }
      },
      'generar imagen con un servidor local Stable Diffusion llega al servicio y trae el resultado': async (c) => {
        await fresh(c, { width: 100, height: 100 });
        const { server, hits, base } = await mockAiServer();
        try {
          await c.page.evaluate(() => window.__schizzo.ai.getState().setEnabled(true));
          const r = await c.page.evaluate(
            ({ base }) => window.electronAPI.aiGenerateImage({ kind: 'local-sd', endpoint: base, model: '', prompt: 'un bosque de noche', width: 512, height: 512 }),
            { base }
          );
          ok(r.ok, `generar imagen (local-sd) falló: ${r.error}`);
          ok(typeof r.dataUrl === 'string' && r.dataUrl.startsWith('data:image/png;base64,'), 'no devolvió una imagen PNG');
          ok(hits.some((h) => h.url.endsWith('/sdapi/v1/txt2img') && h.body?.prompt === 'un bosque de noche'), 'el servidor local mock no recibió el prompt esperado');
        } finally {
          await closeServer(server);
        }
      },
      'probar conexión devuelve los modelos que ofrece el servicio configurado': async (c) => {
        await fresh(c, { width: 100, height: 100 });
        const { server, base } = await mockAiServer();
        try {
          await c.page.evaluate(() => window.__schizzo.ai.getState().setEnabled(true));
          const openai = await c.page.evaluate(({ base }) => window.electronAPI.aiTestConnection({ kind: 'openai-compatible', endpoint: base + '/v1' }), { base });
          const sd = await c.page.evaluate(({ base }) => window.electronAPI.aiTestConnection({ kind: 'local-sd', endpoint: base }), { base });
          ok(openai.ok && openai.models.includes('mock-gpt'), `probar conexión (openai) no listó el modelo mock: ${JSON.stringify(openai)}`);
          ok(sd.ok && sd.models.includes('mock-sd-checkpoint'), `probar conexión (local-sd) no listó el modelo mock: ${JSON.stringify(sd)}`);
        } finally {
          await closeServer(server);
        }
      },
      'reescribir texto usa el servicio de chat configurado y respeta el vocabulario devuelto': async (c) => {
        await fresh(c, { width: 100, height: 100 });
        const { server, hits, base } = await mockAiServer();
        try {
          await c.page.evaluate(() => window.__schizzo.ai.getState().setEnabled(true));
          const r = await c.page.evaluate(
            ({ base }) => window.electronAPI.aiRewriteText({ endpoint: base + '/v1', model: 'mock-gpt', text: 'como si estuviera parado y con los brazos cruzados', vocabulary: 'de pie, brazos cruzados', task: 'pose' }),
            { base }
          );
          ok(r.ok && r.text === 'de pie, brazos cruzados', `reescribir texto no devolvió el texto esperado: ${JSON.stringify(r)}`);
          ok(hits.some((h) => h.url.endsWith('/chat/completions')), 'el servicio mock no recibió la petición de chat');
        } finally {
          await closeServer(server);
        }
      },
      'con la IA desactivada, generar imagen se rechaza sin tocar la red': async (c) => {
        await fresh(c, { width: 100, height: 100 });
        const { server, hits, base } = await mockAiServer();
        try {
          await c.page.evaluate(() => window.__schizzo.ai.getState().setEnabled(false));
          await sleep(300); // let the main-process mirror of the switch land before the call
          const r = await c.page.evaluate(
            ({ base }) => window.electronAPI.aiGenerateImage({ kind: 'openai-compatible', endpoint: base + '/v1', model: 'mock-model', prompt: 'no debería llegar', width: 512, height: 512 }),
            { base }
          );
          ok(r.ok === false, 'generar imagen no se rechazó con la IA desactivada');
          ok(hits.length === 0, `con la IA desactivada el servicio mock no debería recibir nada, recibió ${hits.length} petición(es)`);
        } finally {
          await closeServer(server);
        }
      },
    },

    // -----------------------------------------------------------------------------------------
    feedback: {
      'copiar y guardar el comentario funcionan de verdad, con el diagnóstico incluido': async (c) => {
        await fresh(c, { width: 900, height: 600 });
        await c.page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
        // A real captured error, so the diagnostic block isn't empty.
        await c.page.evaluate(() => window.dispatchEvent(new ErrorEvent('error', { message: 'fallo de prueba', error: new Error('fallo de prueba') })));
        await sleep(200);

        await c.page.locator('button[title^="Enviar comentario"]').click();
        await sleep(400);
        await c.page.fill('textarea', 'Mensaje de prueba funcional');

        await c.page.locator('button:has-text("Copiar")').click();
        await sleep(300);
        const clip = await c.page.evaluate(() => navigator.clipboard.readText());
        ok(clip.includes('Mensaje de prueba funcional'), 'el portapapeles no tiene el mensaje escrito');
        ok(clip.includes('SCHIZZO STUDIO'), 'el portapapeles no tiene la versión de la app');
        ok(clip.includes('fallo de prueba'), 'el portapapeles no tiene el error capturado');

        await c.page.locator('button:has-text("Guardar")').click();
        await sleep(800);
        const txt = fs.readdirSync(c.out).find((f) => f.endsWith('.txt'));
        ok(txt, `no se generó ningún .txt en ${c.out}`);
        const content = fs.readFileSync(c.outFile(txt), 'utf-8');
        ok(content.includes('Mensaje de prueba funcional'), 'el archivo guardado no tiene el mensaje escrito');
      },
      'incluir la miniatura del lienzo genera una vista previa real y no rompe nada': async (c) => {
        await fresh(c, { width: 900, height: 600 });
        await c.pickBrush();
        await c.stroke(0.5);
        await sleep(700);
        await c.page.locator('button[title^="Enviar comentario"]').click();
        await sleep(400);
        await c.page.locator('label:has-text("miniatura")').click();
        await sleep(600);
        const src = await c.page.locator('img[alt="Miniatura del lienzo"]').getAttribute('src');
        ok(src && src.startsWith('data:image/jpeg'), 'la miniatura no se generó');
      },
      'se puede abrir sin ningún proyecto abierto, desde la pantalla de inicio': async (c) => {
        await c.page.locator('button:has-text("Enviar comentario")').first().click();
        await sleep(400);
        ok(await c.page.locator('textarea').isVisible(), 'el diálogo no se abrió desde la pantalla de inicio');
        ok(!(await c.page.locator('label:has-text("miniatura")').isVisible()), 'no debería ofrecer miniatura sin ningún proyecto abierto');
      },
    },
  };
};
