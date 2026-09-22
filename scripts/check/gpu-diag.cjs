const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('playwright-core');

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'schizzo-gpu-'));
  const env = { ...process.env, SCHIZZO_CHECK_DIR: dir };
  const child = spawn(require(path.join(__dirname, '..', '..', 'node_modules', 'electron')), [path.join(__dirname, 'electron-entry.cjs'), '--remote-debugging-port=9900', `--user-data-dir=${path.join(dir, 'profile')}`], { env, stdio: 'ignore', cwd: path.join(__dirname, '..', '..') });
  await new Promise((r) => setTimeout(r, 3000));
  try {
    const browser = await chromium.connectOverCDP('http://127.0.0.1:9900');
    const page = browser.contexts()[0].pages().find((p) => p.url().startsWith('file:'));
    const info = await page.evaluate(() => {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
      if (!gl) return { webgl: false };
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      return {
        webgl: true,
        renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
        vendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
      };
    });
    console.log(JSON.stringify(info, null, 1));
    await browser.close();
  } finally {
    child.kill();
    await new Promise((r) => setTimeout(r, 1000));
    try {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
    } catch {
      /* leftover lock file, harmless for a diagnostic run */
    }
  }
})();
