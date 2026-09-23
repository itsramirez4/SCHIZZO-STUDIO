// Shared by the release scripts: the same token `git push` already uses, from
// ~/.git-credentials, so nothing new has to be configured to publish a release.
const fs = require('fs');
const os = require('os');
const path = require('path');

function readGithubToken() {
  const credLine = fs
    .readFileSync(path.join(os.homedir(), '.git-credentials'), 'utf-8')
    .split('\n')
    .find((l) => l.includes('github.com'));
  if (!credLine) throw new Error('No hay credencial de github.com en ~/.git-credentials');
  return new URL(credLine.trim()).password;
}

module.exports = { readGithubToken };
