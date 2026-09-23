const https = require('https');
const { readGithubToken } = require('./lib/githubToken.cjs');
const token = readGithubToken();
const REPO = 'itsramirez4/SCHIZZO-STUDIO';

function api(method, p, payload) {
  return new Promise((resolve, reject) => {
    const data = payload ? JSON.stringify(payload) : undefined;
    const req = https.request(
      { hostname: 'api.github.com', path: p, method, headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'x', ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}) } },
      (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => resolve({ status: res.statusCode, body: d }));
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

(async () => {
  const r = await api('PATCH', `/repos/${REPO}/releases/394452439`, { draft: false });
  console.log(r.status, r.body);
})();
