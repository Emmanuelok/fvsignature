#!/usr/bin/env node
import {randomBytes, scrypt} from 'node:crypto';

async function readHiddenPassword() {
  if (!process.stdin.isTTY) {
    let input = '';
    for await (const chunk of process.stdin) {
      input += chunk.toString('utf8');
      if (Buffer.byteLength(input, 'utf8') > 2048) throw new Error('Password input is too long.');
    }
    return input.replace(/\r?\n$/, '');
  }
  process.stderr.write('Organizer password (at least 14 characters; input is hidden): ');
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  return new Promise((resolve, reject) => {
    let input = '';
    function finish(error) {
      process.stdin.off('data', onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stderr.write('\n');
      if (error) reject(error); else resolve(input);
    }
    function onData(chunk) {
      for (const character of chunk) {
        if (character === '\u0003' || character === '\u0004') {finish(new Error('Cancelled.')); return;}
        if (character === '\r' || character === '\n') {finish(); return;}
        if (character === '\u007f' || character === '\b') {input = Array.from(input).slice(0, -1).join(''); continue;}
        if (character >= ' ') input += character;
        if (input.length > 256) {finish(new Error('Use no more than 256 characters.')); return;}
      }
    }
    process.stdin.on('data', onData);
  });
}

try {
  if (process.argv.length > 2) throw new Error('Do not put passwords in command arguments. Run this script without arguments.');
  const password = await readHiddenPassword();
  if (password.length < 14 || password.length > 256 || /[\r\n]/.test(password)) throw new Error('Use a unique password between 14 and 256 characters, on a single line.');
  const salt = randomBytes(16);
  const key = await new Promise((resolve, reject) => scrypt(password, salt, 64, {N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024}, (error, result) => error ? reject(error) : resolve(result)));
  process.stdout.write(`scrypt$32768$8$1$${salt.toString('hex')}$${key.toString('hex')}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'Unable to create password hash.'}\n`);
  process.exitCode = 1;
}
