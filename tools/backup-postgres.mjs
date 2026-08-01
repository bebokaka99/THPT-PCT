import { execFileSync, spawn } from 'node:child_process';
import { closeSync, openSync } from 'node:fs';
import { rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  composeArgs,
  encryptFile,
  encryptionKey,
  ensurePrivateDirectory,
  loadEnvFile,
  parseArgs,
  positiveInteger,
  resolveInside,
  safeUnlink,
  sha256,
} from './backup-lib.mjs';

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: 'utf8',
    stdio: options.capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    maxBuffer: 16 * 1024 * 1024,
  })?.trim() ?? '';
}

function streamCommand(command, args, destination) {
  return new Promise((resolve, reject) => {
    const output = openSync(destination, 'w', 0o600);
    const child = spawn(command, args, { stdio: ['ignore', output, 'inherit'] });
    child.once('error', reject);
    child.once('close', (code) => {
      closeSync(output);
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}.`));
    });
  });
}

function timestampName() {
  return `backup-${new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_')}`;
}

function countSql() {
  return `SELECT json_build_object(
    'schema_migrations', (SELECT COUNT(*) FROM schema_migrations),
    'users', (SELECT COUNT(*) FROM users),
    'classrooms', (SELECT COUNT(*) FROM classrooms),
    'posts', (SELECT COUNT(*) FROM posts),
    'documents', (SELECT COUNT(*) FROM documents),
    'media_files', (SELECT COUNT(*) FROM media_files),
    'student_enrollments', (SELECT COUNT(*) FROM student_enrollments),
    'teaching_assignments', (SELECT COUNT(*) FROM teaching_assignments),
    'gradebooks', (SELECT COUNT(*) FROM gradebooks),
    'attendance_sessions', (SELECT COUNT(*) FROM attendance_sessions),
    'class_journal_entries', (SELECT COUNT(*) FROM class_journal_entries)
  )::text;`;
}

async function applyRetention(root, days) {
  const { readdir, readFile } = await import('node:fs/promises');
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith('backup-')) continue;
    const directory = resolveInside(root, entry.name);
    try {
      const manifest = JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8'));
      if (Date.parse(manifest.created_at) < cutoff) {
        await rm(directory, { recursive: true, force: true });
        console.log(`Removed expired backup ${entry.name}.`);
      }
    } catch {
      console.warn(`Skipped retention for backup without a valid manifest: ${entry.name}`);
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const envFile = path.resolve(String(args['env-file'] ?? '.env.docker'));
  const outputRoot = path.resolve(String(args['output-dir'] ?? 'backups'));
  const retentionDays = positiveInteger(args['retention-days'], 30, 'retention-days');
  const projectName = typeof args['project-name'] === 'string' ? args['project-name'] : undefined;
  const allowPlaintext = args['allow-plaintext'] === true;
  const key = encryptionKey(allowPlaintext);
  const env = await loadEnvFile(envFile);
  const database = env.POSTGRES_DB || 'thpt_pct_pt';
  const databaseUser = env.POSTGRES_USER || 'thpt_pct_pt';
  const options = { envFile, projectName };

  await ensurePrivateDirectory(outputRoot);
  const backupDirectory = resolveInside(outputRoot, timestampName());
  await ensurePrivateDirectory(backupDirectory);
  const databasePlain = path.join(backupDirectory, 'database.dump');
  const uploadsPlain = path.join(backupDirectory, 'uploads.tar.gz');
  let backendPaused = false;

  try {
    const running = run('docker', composeArgs(options, ['ps', '--status', 'running', '--services']), { capture: true })
      .split(/\r?\n/).filter(Boolean);
    if (!running.includes('postgres')) throw new Error('Compose postgres service is not running.');
    if (!running.includes('backend')) throw new Error('Compose backend service is not running.');
    const backendContainer = run('docker', composeArgs(options, ['ps', '-q', 'backend']), { capture: true });
    if (!backendContainer) throw new Error('Could not resolve the backend container ID.');

    run('docker', composeArgs(options, ['pause', 'backend']));
    backendPaused = true;

    await streamCommand('docker', composeArgs(options, [
      'exec', '-T', 'postgres', 'pg_dump',
      '--username', databaseUser,
      '--dbname', database,
      '--format=custom',
      '--compress=9',
      '--no-owner',
      '--no-privileges',
    ]), databasePlain);

    await streamCommand('docker', [
      'run', '--rm', '--volumes-from', backendContainer,
      'alpine:3.23', 'tar', '-C', '/app/backend', '-czf', '-', 'uploads', 'private-uploads',
    ], uploadsPlain);

    const countsRaw = run('docker', composeArgs(options, [
      'exec', '-T', 'postgres', 'psql', '--username', databaseUser,
      '--dbname', database, '--tuples-only', '--no-align', '--command', countSql(),
    ]), { capture: true });
    const tableCounts = JSON.parse(countsRaw);

    run('docker', composeArgs(options, ['unpause', 'backend']));
    backendPaused = false;

    const databaseFile = key ? `${databasePlain}.enc` : databasePlain;
    const uploadsFile = key ? `${uploadsPlain}.enc` : uploadsPlain;
    if (key) {
      await encryptFile(databasePlain, databaseFile, key);
      await encryptFile(uploadsPlain, uploadsFile, key);
      await safeUnlink(databasePlain);
      await safeUnlink(uploadsPlain);
    }

    const [databaseInfo, uploadsInfo, databaseHash, uploadsHash] = await Promise.all([
      stat(databaseFile), stat(uploadsFile), sha256(databaseFile), sha256(uploadsFile),
    ]);
    let sourceCommit = null;
    try { sourceCommit = run('git', ['rev-parse', 'HEAD'], { capture: true }); } catch { /* source archive may not include Git metadata */ }
    const manifest = {
      format_version: 1,
      created_at: new Date().toISOString(),
      source_commit: sourceCommit,
      database,
      encryption: key ? { enabled: true, algorithm: 'aes-256-gcm' } : { enabled: false, algorithm: null },
      consistency: 'backend-paused-during-database-and-upload-snapshot',
      table_counts: tableCounts,
      artifacts: [
        { name: path.basename(databaseFile), kind: 'postgres-custom-dump', size: databaseInfo.size, sha256: databaseHash },
        { name: path.basename(uploadsFile), kind: 'uploads-tar-gzip', size: uploadsInfo.size, sha256: uploadsHash },
      ],
    };
    const manifestPath = path.join(backupDirectory, 'manifest.json');
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
    const manifestHash = await sha256(manifestPath);
    const checksums = [
      `${databaseHash}  ${path.basename(databaseFile)}`,
      `${uploadsHash}  ${path.basename(uploadsFile)}`,
      `${manifestHash}  manifest.json`,
    ].join('\n');
    await writeFile(path.join(backupDirectory, 'SHA256SUMS'), `${checksums}\n`, { mode: 0o600 });
    await applyRetention(outputRoot, retentionDays);
    console.log(`Backup completed: ${backupDirectory}`);
    console.log(`BACKUP_DIRECTORY=${backupDirectory}`);
  } catch (error) {
    await rm(backupDirectory, { recursive: true, force: true });
    throw error;
  } finally {
    if (backendPaused) {
      try { run('docker', composeArgs(options, ['unpause', 'backend'])); } catch { console.error('Failed to unpause backend after backup failure.'); }
    }
  }
}

main().catch((error) => {
  console.error(`Backup failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
