// Extracts release/neon-swarm.zip into release/build for the smoke tests.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';

const zip = 'release/neon-swarm.zip';
if (!existsSync(zip)) {
  console.error('release/neon-swarm.zip not found: run `npm run build && npm run package`');
  process.exit(1);
}
rmSync('release/build', { recursive: true, force: true });
mkdirSync('release/build', { recursive: true });
try {
  execFileSync('unzip', ['-q', '-o', zip, '-d', 'release/build']);
} catch {
  execFileSync('python3', ['-c', `import zipfile; zipfile.ZipFile('${zip}').extractall('release/build')`]);
}
console.log('extracted', zip);
