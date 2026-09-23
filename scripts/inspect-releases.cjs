const https = require('https');
const { readGithubToken } = require('./lib/githubToken.cjs');
const token = readGithubToken();
const REPO = 'itsramirez4/SCHIZZO-STUDIO';

function api(p) {
  return new Promise((resolve, reject) => {
    https.get(
      { hostname: 'api.github.com', path: p, headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'x' } },
      (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => resolve(JSON.parse(d)));
      }
    ).on('error', reject);
  });
}

(async () => {
  const releases = await api(`/repos/${REPO}/releases`);
  for (const r of releases) {
    console.log(`id=${r.id} tag=${r.tag_name} draft=${r.draft} prerelease=${r.prerelease} target=${r.target_commitish} assets=${r.assets.map((a) => a.name).join(',')}`);
  }
  const tags = await api(`/repos/${REPO}/tags`);
  console.log('tags:', tags.map((t) => `${t.name}@${t.commit.sha.slice(0, 7)}`).join(' | '));
})();
