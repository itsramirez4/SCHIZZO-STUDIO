const https = require('https');
const { readGithubToken } = require('./lib/githubToken.cjs');
const token = readGithubToken();
const REPO = 'itsramirez4/SCHIZZO-STUDIO';
const id = process.argv[2];

https
  .get({ hostname: 'api.github.com', path: `/repos/${REPO}/releases/${id}`, headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'x' } }, (res) => {
    let d = '';
    res.on('data', (c) => (d += c));
    res.on('end', () => {
      const j = JSON.parse(d);
      console.log(JSON.stringify({ id: j.id, tag: j.tag_name, draft: j.draft, prerelease: j.prerelease, body_len: j.body?.length, assets: j.assets?.map((a) => ({ name: a.name, size: a.size, state: a.state })) }, null, 1));
    });
  })
  .on('error', console.error);
