// One-off: creates the GitHub Release for an already-pushed tag, using the matching CHANGELOG.md
// section as the release notes. Reads the token from ~/.git-credentials (same one `git push`
// already uses) instead of asking for a new one. Not part of any npm script — run manually.
const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');

const TAG = process.argv[2];
if (!TAG) {
  console.error('Uso: node scripts/make-release.cjs <tag>');
  process.exit(2);
}

const REPO = 'itsramirez4/SCHIZZO-STUDIO';
const changelog = fs.readFileSync(path.join(__dirname, '..', 'CHANGELOG.md'), 'utf-8');
const version = TAG.replace(/^v/, '');
const re = new RegExp(`## \\[${version.replace(/\./g, '\\.')}\\][^\\n]*\\n([\\s\\S]*?)(?=\\n## \\[|$)`);
const m = changelog.match(re);
if (!m) {
  console.error(`No se encontró la sección "## [${version}]" en CHANGELOG.md`);
  process.exit(2);
}
const body = m[1].trim() + `\n\n---\n[Registro de cambios completo](CHANGELOG.md)`;

const credLine = fs
  .readFileSync(path.join(os.homedir(), '.git-credentials'), 'utf-8')
  .split('\n')
  .find((l) => l.includes('github.com'));
if (!credLine) {
  console.error('No hay credencial de github.com en ~/.git-credentials');
  process.exit(2);
}
const token = new URL(credLine.trim()).password;

const payload = JSON.stringify({
  tag_name: TAG,
  name: TAG,
  body,
  draft: false,
  prerelease: true, // 0.y.z: development snapshot, not a stable public release yet
});

const req = https.request(
  {
    hostname: 'api.github.com',
    path: `/repos/${REPO}/releases`,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'schizzo-studio-release-script',
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    },
  },
  (res) => {
    let data = '';
    res.on('data', (c) => (data += c));
    res.on('end', () => {
      const json = JSON.parse(data);
      if (res.statusCode >= 200 && res.statusCode < 300) {
        console.log('OK', json.html_url);
      } else {
        console.error('FAIL', res.statusCode, json.message, json.errors ?? '');
        process.exit(1);
      }
    });
  }
);
req.on('error', (e) => {
  console.error('FAIL', e.message);
  process.exit(1);
});
req.write(payload);
req.end();
