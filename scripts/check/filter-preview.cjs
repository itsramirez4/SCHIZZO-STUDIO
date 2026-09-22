// Renders every "artistic"/atmospheric filter with its real UI default values on a representative
// test scene, and saves each result as a PNG so it can be looked at (npm run check only confirms
// these don't crash and, for the plain ones, that the math is right — not whether they look good).
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('playwright-core');

const OUT = path.join(__dirname, '..', '..', 'filter-previews');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'schizzo-filterprev-'));
  const env = { ...process.env, SCHIZZO_CHECK_DIR: dir };
  delete env.ELECTRON_RUN_AS_NODE;
  const ROOT = path.join(__dirname, '..', '..');
  const child = spawn(require(path.join(ROOT, 'node_modules', 'electron')), [path.join(__dirname, 'electron-entry.cjs'), '--remote-debugging-port=9910', `--user-data-dir=${path.join(dir, 'profile')}`], { env, stdio: 'ignore', cwd: ROOT });
  await new Promise((r) => setTimeout(r, 3000));
  const errors = [];
  try {
    const browser = await chromium.connectOverCDP('http://127.0.0.1:9910');
    const page = browser.contexts()[0].pages().find((p) => p.url().startsWith('file:'));
    page.on('pageerror', (e) => errors.push(e.message));
    await page.evaluate(() => localStorage.setItem('schizzo:check', '1'));
    await page.reload();
    await page.waitForTimeout(1500);

    const files = await page.evaluate(async () => {
      const F = window.__schizzo.filters;
      const G = window.__schizzo.geometry;

      // A representative scene, not a flat gradient: sky, a bright sun (for bloom), a silhouetted
      // mountain range (hard edges, for edge-detection/toon/pencil), a few colored objects (for
      // posterize/sepia/oil), and fine detail (a scatter of dots, for oil-paint smoothing to show).
      function scene() {
        const c = document.createElement('canvas');
        c.width = 480;
        c.height = 320;
        const ctx = c.getContext('2d');
        const sky = ctx.createLinearGradient(0, 0, 0, 320);
        sky.addColorStop(0, '#2b4d8f');
        sky.addColorStop(0.6, '#e8a24a');
        sky.addColorStop(1, '#f6d98a');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, 480, 320);
        ctx.save();
        ctx.shadowColor = '#fff2c4';
        ctx.shadowBlur = 40;
        ctx.fillStyle = '#fff6d8';
        ctx.beginPath();
        ctx.arc(340, 90, 34, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#1a2233';
        ctx.beginPath();
        ctx.moveTo(0, 320);
        ctx.lineTo(0, 220);
        ctx.lineTo(90, 140);
        ctx.lineTo(160, 210);
        ctx.lineTo(230, 120);
        ctx.lineTo(300, 200);
        ctx.lineTo(380, 150);
        ctx.lineTo(480, 230);
        ctx.lineTo(480, 320);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#d94f4f';
        ctx.fillRect(60, 250, 70, 50);
        ctx.fillStyle = '#4fae6a';
        ctx.beginPath();
        ctx.arc(220, 265, 30, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#4f7fd9';
        ctx.beginPath();
        ctx.moveTo(340, 300);
        ctx.lineTo(380, 240);
        ctx.lineTo(420, 300);
        ctx.closePath();
        ctx.fill();
        let seed = 7;
        const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
        for (let i = 0; i < 90; i++) {
          ctx.fillStyle = `rgba(255,255,255,${0.15 + rand() * 0.3})`;
          ctx.fillRect(rand() * 480, rand() * 180, 1.5, 1.5);
        }
        return c;
      }

      const clone = (c) => {
        const o = document.createElement('canvas');
        o.width = c.width;
        o.height = c.height;
        o.getContext('2d').drawImage(c, 0, 0);
        return o;
      };

      // Name -> function using the same defaults the filter panels open with.
      const cases = {
        '00-original': (c) => c,
        '01-oleo-radio3': (c) => F.oilPaint(c, 3),
        '02-carboncillo-2': (c) => F.charcoal(c, 2),
        '03-posterizar-4niveles': (c) => F.posterize(c, 4),
        '04-sepia-80pct': (c) => F.sepia(c, 0.8),
        '05-bordes-umbral80': (c) => F.edgeDetection(c, 80),
        '06-resplandor-r8-f60pct': (c) => F.bloom(c, 8, 0.6),
        '07-boceto-lapiz': (c) => G.pencilSketch(c, 8, 90),
        '08-comic-celshading': (c) => G.toonShading(c, 5, 80),
        '09-mosaico-16px': (c) => G.mosaic(c, 16, 2, '#101010'),
        '10-cristalizar-20px': (c) => G.crystallize(c, 20),
        '11-niebla-50pct': (c) => F.applyFog(c, 0.5, '#c8c8c8'),
        '12-polvo-40pct': (c) => F.applyDust(c, 40, '#e0d8c0'),
        '13-humo-40pct': (c) => F.applySmoke(c, 40, '#969696'),
        '14-lluvia-50pct': (c) => F.applyRain(c, 50, 70, '#a8c8e0'),
      };

      const out = [];
      for (const [name, fn] of Object.entries(cases)) {
        const canvas = clone(scene());
        const result = fn(canvas) || canvas; // some mutate in place, some (pencil/toon/mosaic/crystallize) return a new canvas
        out.push({ name, dataUrl: result.toDataURL('image/png') });
      }
      return out;
    });

    for (const { name, dataUrl } of files) {
      const b64 = dataUrl.replace(/^data:image\/png;base64,/, '');
      fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(b64, 'base64'));
    }
    console.log(JSON.stringify({ saved: files.map((f) => f.name), dir: OUT, errors }, null, 1));
    await browser.close().catch(() => {});
  } finally {
    child.kill();
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* leftover lock file, harmless */
    }
  }
})();
