#!/usr/bin/env node
/**
 * Comprueba el AppImage de Linux de verdad: lo genera, lo arranca, dibuja, deshace, rehace y
 * comprueba la reproducción del proceso — el equivalente Linux de check-installer.cjs.
 *
 *   npm run check:linux                 -> genera el AppImage y lo prueba
 *   node scripts/check-linux.cjs --no-build   -> prueba el que ya haya en release/
 *
 * Solo Linux. Probado en Ubuntu 24.04 sobre WSL2 (kernel real, no emulación); en una máquina
 * Linux normal con GPU debería ir igual o mejor — WSLg cayó a render por software (SwiftShader)
 * al faltarle el driver Vulkan D3D12 (dozen) de Mesa, lo que hizo fallar solo la comprobación de
 * rendimiento del resto de la batería (ver "Estado por plataforma" en README.md).
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

if (process.platform !== 'linux') {
  console.error('Este comprobador es solo para Linux (AppImage).');
  process.exit(2);
}

const ROOT = path.resolve(__dirname, '..');
const skipBuild = process.argv.includes('--no-build');

if (!skipBuild) {
  console.log('Generando el AppImage (npx electron-builder --linux)…');
  fs.rmSync(path.join(ROOT, 'release'), { recursive: true, force: true });
  execSync('npm run build && npx electron-builder --linux', { cwd: ROOT, stdio: 'inherit' });
}

const appImage = fs.existsSync(path.join(ROOT, 'release')) && fs.readdirSync(path.join(ROOT, 'release')).find((f) => f.endsWith('.AppImage'));
if (!appImage) {
  console.error('No hay ningún .AppImage en release/. Ejecuta sin --no-build.');
  process.exit(2);
}

execSync(`node "${path.join(__dirname, 'check', 'appimage-smoke.cjs')}"`, { cwd: ROOT, stdio: 'inherit' });
