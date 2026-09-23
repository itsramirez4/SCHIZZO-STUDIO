const fs = require('fs');
const path = require('path');
const https = require('https');
const { readGithubToken } = require('./lib/githubToken.cjs');

const token = readGithubToken();
const REPO = 'itsramirez4/SCHIZZO-STUDIO';
const TAG = 'v0.1.1';
const version = TAG.replace(/^v/, '');
const changelog = fs.readFileSync(path.join(__dirname, '..', 'CHANGELOG.md'), 'utf-8');
const re = new RegExp(`## \\[${version.replace(/\./g, '\\.')}\\][^\\n]*\\n([\\s\\S]*?)(?=\\n## \\[|$)`);
const body = changelog.match(re)[1].trim() + `\n\n---\n[Registro de cambios completo](CHANGELOG.md)`;

function api(method, p, payload) {
  return new Promise((resolve, reject) => {
    const data = payload ? JSON.stringify(payload) : undefined;
    const req = https.request(
      { hostname: 'api.github.com', path: p, method, headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'x', ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}) } },
      (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => resolve({ status: res.statusCode, json: d ? JSON.parse(d) : null }));
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

(async () => {
  // Publish the release electron-builder created (id 394452439) as draft, with the real assets:
  // un-draft it, mark prerelease (matches this project's 0.y.z policy), and use the real notes.
  const r1 = await api('PATCH', `/repos/${REPO}/releases/394452439`, { draft: false, prerelease: true, name: TAG, body });
  console.log('publish draft ->', r1.status, r1.json?.html_url);

  // Delete the empty duplicate make-release.cjs created before I knew the draft already existed.
  const r2 = await api('DELETE', `/repos/${REPO}/releases/394452758`);
  console.log('delete duplicate ->', r2.status || 204);
})();
