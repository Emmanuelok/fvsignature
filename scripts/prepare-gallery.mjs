import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const photos = JSON.parse(await readFile(path.join(root, 'lib/gallery-photos.json'), 'utf8'));

// WebP is already compressed. A standard, uncompressed ZIP keeps the original
// photographs intact and needs no extra build dependencies or binary uploads.
const table = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  return value >>> 0;
});
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (crc >>> 8) ^ table[(crc ^ byte) & 255];
  return (crc ^ 0xffffffff) >>> 0;
}

const entries = [];
const directory = [];
let offset = 0;
for (const photo of photos) {
  const bytes = await readFile(path.join(root, 'public/photos', `${photo.id}.webp`));
  const name = Buffer.from(`${photo.id}-${photo.title.toLowerCase().replaceAll(' ', '-')}.webp`);
  const checksum = crc32(bytes);
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(33, 12); // Deterministic DOS date: 1980-01-01.
  header.writeUInt32LE(checksum, 14);
  header.writeUInt32LE(bytes.length, 18);
  header.writeUInt32LE(bytes.length, 22);
  header.writeUInt16LE(name.length, 26);
  entries.push(header, name, bytes);

  const record = Buffer.alloc(46);
  record.writeUInt32LE(0x02014b50, 0);
  record.writeUInt16LE(20, 4);
  record.writeUInt16LE(20, 6);
  record.writeUInt16LE(33, 14);
  record.writeUInt32LE(checksum, 16);
  record.writeUInt32LE(bytes.length, 20);
  record.writeUInt32LE(bytes.length, 24);
  record.writeUInt16LE(name.length, 28);
  record.writeUInt32LE(offset, 42);
  directory.push(record, name);
  offset += header.length + name.length + bytes.length;
}

const directoryBytes = Buffer.concat(directory);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(photos.length, 8);
end.writeUInt16LE(photos.length, 10);
end.writeUInt32LE(directoryBytes.length, 12);
end.writeUInt32LE(offset, 16);
await writeFile(path.join(root, 'public/Frederick-Veronica-Selected-Photographs.zip'), Buffer.concat([...entries, directoryBytes, end]));
console.log(`Prepared curated collection: ${photos.length} photographs`);
