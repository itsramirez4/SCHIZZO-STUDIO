/**
 * Grupos de comprobaciones "a fondo": capas, filtros, selección/transformaciones, pixel art, cómic,
 * animación, paneles e IA. Usan el gancho `window.__schizzo` (ver src/checkHook.ts) para preparar
 * píxeles exactos y leer el estado real de la app, en vez de fiarse solo de lo que se ve.
 */
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
            oilPaint: (v) => F.oilPaint(v, 2), applyFog: (v) => F.applyFog(v, 0.3, '#ffffff'), applyDust: (v) => F.applyDust(v, 0.3, '#ffffff'),
            applySmoke: (v) => F.applySmoke(v, 0.3, '#888888'), applyRain: (v) => F.applyRain(v, 0.3, 20, '#aaccff'),
            quantize: (v) => F.quantizeToPalette(v, [[0, 0, 0], [255, 255, 255], [255, 0, 0]]),
            dither: (v) => F.ditherToPalette(v, [[0, 0, 0], [255, 255, 255]], 0.8),
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
  };
};
