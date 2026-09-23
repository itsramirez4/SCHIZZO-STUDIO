// Sets the GitHub Release notes for a tag, using the matching CHANGELOG.md section — idempotent:
// creates the release if it doesn't exist yet, or just updates its notes if `electron-builder
// --publish` (see scripts/release.cjs) already created it while uploading the installers.
// Reads the token from ~/.git-credentials (same one `git push` already uses).
const fs = require('fs');
const path = require('path');
const https = require('https');
const { readGithubToken } = require('./lib/githubToken.cjs');

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
const token = readGithubToken();

function api(method, apiPath, payload) {
  return new Promise((resolve, reject) => {
    const data = payload ? JSON.stringify(payload) : undefined;
    const req = https.request(
      {
        hostname: 'api.github.com',
        path: apiPath,
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'schizzo-studio-release-script',
          ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}),
        },
      },
      (res) => {
        let out = '';
        res.on('data', (c) => (out += c));
        res.on('end', () => resolve({ status: res.statusCode, json: out ? JSON.parse(out) : null }));
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

(async () => {
  const existing = await api('GET', `/repos/${REPO}/releases/tags/${TAG}`);
  const payload = { tag_name: TAG, name: TAG, body, draft: false, prerelease: true };

  const r =
    existing.status === 200
      ? await api('PATCH', `/repos/${REPO}/releases/${existing.json.id}`, payload)
      : await api('POST', `/repos/${REPO}/releases`, payload);

  if (r.status >= 200 && r.status < 300) {
    console.log(existing.status === 200 ? 'Notas actualizadas:' : 'Creado:', r.json.html_url);
  } else {
    console.error('FAIL', r.status, r.json?.message, r.json?.errors ?? '');
    process.exit(1);
  }
})();
