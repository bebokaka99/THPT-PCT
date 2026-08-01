import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, open, readFile, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

const MAGIC = Buffer.from('PCTBKP01');
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

export function parseArgs(argv) {
  const result = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith('--')) {
      result._.push(value);
      continue;
    }
    const key = value.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      result[key] = true;
      continue;
    }
    result[key] = next;
    index += 1;
  }
  return result;
}

export function requiredString(value, name) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${name} is required.`);
  }
  return value.trim();
}

export function positiveInteger(value, fallback, name) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

export async function loadEnvFile(filePath) {
  const values = {};
  const content = await readFile(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

export function composeArgs(options, commandArgs) {
  const args = ['compose'];
  if (options.projectName) args.push('--project-name', options.projectName);
  args.push('--env-file', options.envFile, ...commandArgs);
  return args;
}

export function encryptionKey(allowPlaintext = false) {
  const encoded = process.env.BACKUP_ENCRYPTION_KEY?.trim();
  if (!encoded) {
    if (allowPlaintext) return null;
    throw new Error('BACKUP_ENCRYPTION_KEY is required and must be a base64-encoded 32-byte key.');
  }
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32 || key.toString('base64').replace(/=+$/, '') !== encoded.replace(/=+$/, '')) {
    throw new Error('BACKUP_ENCRYPTION_KEY must decode to exactly 32 bytes.');
  }
  return key;
}

export async function encryptFile(sourcePath, destinationPath, key) {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const output = createWriteStream(destinationPath, { mode: 0o600 });
  output.write(MAGIC);
  output.write(Buffer.from(iv));
  await pipeline(createReadStream(sourcePath), cipher, output, { end: false });
  await new Promise((resolve, reject) => {
    output.end(cipher.getAuthTag(), (error) => error ? reject(error) : resolve());
  });
}

export async function decryptFile(sourcePath, destinationPath, key) {
  const metadata = await stat(sourcePath);
  if (metadata.size <= MAGIC.length + IV_LENGTH + TAG_LENGTH) {
    throw new Error(`Encrypted backup is truncated: ${sourcePath}`);
  }
  const handle = await open(sourcePath, 'r');
  try {
    const header = Buffer.alloc(MAGIC.length + IV_LENGTH);
    await handle.read(header, 0, header.length, 0);
    if (!header.subarray(0, MAGIC.length).equals(MAGIC)) {
      throw new Error(`Encrypted backup header is invalid: ${sourcePath}`);
    }
    const tag = Buffer.alloc(TAG_LENGTH);
    await handle.read(tag, 0, TAG_LENGTH, metadata.size - TAG_LENGTH);
    const decipher = createDecipheriv('aes-256-gcm', key, header.subarray(MAGIC.length));
    decipher.setAuthTag(tag);
    await pipeline(
      createReadStream(sourcePath, { start: header.length, end: metadata.size - TAG_LENGTH - 1 }),
      decipher,
      createWriteStream(destinationPath, { mode: 0o600 }),
    );
  } finally {
    await handle.close();
  }
}

export async function sha256(filePath) {
  const hash = createHash('sha256');
  await pipeline(createReadStream(filePath), hash);
  return hash.digest('hex');
}

export async function ensurePrivateDirectory(directory) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  if (process.platform !== 'win32') {
    const { chmod } = await import('node:fs/promises');
    await chmod(directory, 0o700);
  }
}

export async function safeUnlink(filePath) {
  try {
    await unlink(filePath);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

export function resolveInside(root, child) {
  const resolvedRoot = path.resolve(root);
  const resolvedChild = path.resolve(resolvedRoot, child);
  if (resolvedChild !== resolvedRoot && !resolvedChild.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`Path escapes the configured root: ${child}`);
  }
  return resolvedChild;
}

export { MAGIC, IV_LENGTH, TAG_LENGTH };
