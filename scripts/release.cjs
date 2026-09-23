#!/usr/bin/env node
/**
 * One command for a full release: build, publish the Windows installer + portable + the
 * latest.yml electron-updater reads (to the GitHub release for the version currently in
 * package.json), write the release notes from CHANGELOG.md, and tag/push the commit.
 *
 *   node scripts/release.cjs
 *
 * Run after bumping "version" in package.json and adding that version's section to
 * CHANGELOG.md, with everything else already committed. Windows only (matches `npm run
 * package`) — this machine can't build the macOS/Linux artifacts electron-updater would need
 * for those platforms anyway.
 */
const { spawnSync } = require('child_process');
const path = require('path');
const { readGithubToken } = require('./lib/githubToken.cjs');

if (process.platform !== 'win32') {
  console.error('Este script construye el instalador de Windows; ejecútalo ahí.');
  process.exit(2);
}

const ROOT = path.resolve(__dirname, '..');
const version = require(path.join(ROOT, 'package.json')).version;
const tag = `v${version}`;

function run(cmd, args, extraEnv) {
  console.log(`\n$ ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: true, env: { ...process.env, ...extraEnv } });
  if (r.status !== 0) {
    console.error(`FAIL (${r.status}): ${cmd} ${args.join(' ')}`);
    process.exit(r.status ?? 1);
  }
}

console.log(`Publicando ${tag}…`);

// Build renderer+main, then build the Windows installer/portable AND upload them plus
// latest.yml to the GitHub release for this tag (creating it if it doesn't exist yet).
run('npm', ['run', 'build']);
run('npx', ['electron-builder', '--publish', 'always'], { GH_TOKEN: readGithubToken() });

// electron-builder's own release (from --publish) has electron-builder's generic auto-notes;
// overwrite them with the real ones from CHANGELOG.md.
run('node', [path.join(__dirname, 'make-release.cjs'), tag]);

// Tag the commit that was actually built, and push it — -c credential.helper=store avoids a
// known hang in this environment where the "manager" helper waits forever for an interactive
// prompt that can't be shown; "store" already has the same credential cached.
run('git', ['tag', '-a', tag, '-m', `"Release ${tag}"`]);
run('git', ['-c', 'credential.helper=', '-c', 'credential.helper=store', 'push', 'origin', tag]);

console.log(`\n${tag} publicado: https://github.com/itsramirez4/SCHIZZO-STUDIO/releases/tag/${tag}`);
