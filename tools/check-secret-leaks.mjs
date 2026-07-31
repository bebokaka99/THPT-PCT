import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const invocationDirectory = process.cwd();
const gitRootResult = spawnSync('git', ['rev-parse', '--show-toplevel'], {
  cwd: invocationDirectory,
  encoding: 'utf8',
});
if (gitRootResult.status !== 0) {
  throw new Error('Secret scanning must run inside a Git repository');
}
const root = gitRootResult.stdout.trim();
const frontendDistFlag = process.argv.indexOf('--frontend-dist');
const frontendDist = frontendDistFlag >= 0
  ? path.resolve(invocationDirectory, process.argv[frontendDistFlag + 1] ?? '')
  : null;

const rules = [
  { name: 'private key', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'GitHub token', pattern: /\bgh[pousr]_[A-Za-z0-9_]{30,}\b/ },
  { name: 'AWS access key', pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/ },
  { name: 'Slack token', pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/ },
];
const frontendForbiddenNames = [
  /\bJWT_SECRET\b/,
  /\bJWT_PREVIOUS_SECRETS\b/,
  /\bDATABASE_URL\b/,
  /\bPGPASSWORD\b/,
  /\bPOSTGRES_PASSWORD\b/,
];

function getTrackedFiles() {
  const result = spawnSync('git', ['ls-files', '-z'], {
    cwd: root,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error('Unable to list Git-tracked files for secret scanning');
  }
  return result.stdout.split('\0').filter(Boolean);
}

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(entryPath) : [entryPath];
  });
}

function readText(filePath) {
  const content = fs.readFileSync(filePath);
  if (content.includes(0)) return null;
  return content.toString('utf8');
}

const findings = [];
const trackedFiles = getTrackedFiles();

for (const relativePath of trackedFiles) {
  const normalized = relativePath.replaceAll('\\', '/');
  const baseName = path.posix.basename(normalized);
  if (
    baseName.startsWith('.env') &&
    !baseName.endsWith('.example') &&
    baseName !== '.env.docker.example'
  ) {
    findings.push(`${normalized}: tracked environment file`);
    continue;
  }

  const text = readText(path.resolve(root, relativePath));
  if (text === null) continue;
  for (const rule of rules) {
    if (rule.pattern.test(text)) findings.push(`${normalized}: ${rule.name}`);
  }
}

if (frontendDist) {
  for (const filePath of walk(frontendDist)) {
    const text = readText(filePath);
    if (text === null) continue;
    for (const pattern of [...frontendForbiddenNames, ...rules.map((rule) => rule.pattern)]) {
      if (pattern.test(text)) {
        findings.push(`${path.relative(root, filePath)}: forbidden secret marker in frontend bundle`);
        break;
      }
    }
  }
}

if (findings.length) {
  console.error('Secret leak check failed (values are intentionally not printed):');
  findings.forEach((finding) => console.error(`- ${finding}`));
  process.exit(1);
}

console.log(
  `Secret leak check passed for ${trackedFiles.length} tracked files${frontendDist ? ' and the frontend bundle' : ''}.`,
);
