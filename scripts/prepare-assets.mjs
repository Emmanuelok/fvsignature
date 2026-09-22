import {readFile, writeFile, mkdir, rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(await readFile(path.join(root, 'assets/packed/manifest.json'), 'utf8'));
const digest = value => createHash('sha256').update(value).digest('hex');

for (const asset of manifest) {
  const destination = path.join(root, asset.output);
  const existing = await readFile(destination).catch(error => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (existing?.length === asset.bytes && digest(existing) === asset.sha256) continue;

  const bytes = Buffer.concat(await Promise.all(asset.parts.map(part => readFile(path.join(root, part)))));
  if (bytes.length !== asset.bytes || digest(bytes) !== asset.sha256) {
    throw new Error(`Asset integrity check failed: ${asset.output}`);
  }
  await mkdir(path.dirname(destination), {recursive: true});
  await writeFile(destination + '.tmp', bytes);
  await rename(destination + '.tmp', destination);
  console.log(`Prepared ${asset.output}`);
}
