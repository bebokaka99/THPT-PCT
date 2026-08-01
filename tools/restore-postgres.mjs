import { execFileSync, spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { copyFile, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import {
  composeArgs,
  decryptFile,
  encryptionKey,
  loadEnvFile,
  parseArgs,
  requiredString,
  resolveInside,
  sha256,
} from './backup-lib.mjs';

const COUNT_TABLES = [
  'schema_migrations', 'users', 'classrooms', 'posts', 'documents', 'media_files',
  'student_enrollments', 'teaching_assignments', 'gradebooks', 'attendance_sessions',
  'class_journal_entries',
];

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: 'utf8',
    stdio: options.capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    maxBuffer: 16 * 1024 * 1024,
  })?.trim() ?? '';
}

function streamInput(command, args, sourceFile, capture = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['pipe', capture ? 'pipe' : 'inherit', 'inherit'] });
    let output = '';
    if (capture) child.stdout.on('data', (chunk) => { output += chunk.toString(); });
    const input = createReadStream(sourceFile);
    input.pipe(child.stdin);
    input.once('error', reject);
    child.once('error', reject);
    child.once('close', (code) => code === 0 ? resolve(output) : reject(new Error(`${command} exited with code ${code}.`)));
  });
}

function databaseName(value, field) {
  const parsed = requiredString(value, field);
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(parsed)) {
    throw new Error(`${field} must contain lowercase letters, numbers, or underscores and start with a letter.`);
  }
  return parsed;
}

function countSql() {
  return `SELECT json_build_object(${COUNT_TABLES.map((table) => `'${table}', (SELECT COUNT(*) FROM ${table})`).join(', ')})::text;`;
}

async function verifyArtifacts(backupDirectory, manifest) {
  if (!Array.isArray(manifest.artifacts) || manifest.artifacts.length !== 2) {
    throw new Error('Backup manifest must contain database and upload artifacts.');
  }
  for (const artifact of manifest.artifacts) {
    const artifactPath = resolveInside(backupDirectory, requiredString(artifact.name, 'artifact.name'));
    const metadata = await stat(artifactPath);
    if (metadata.size !== Number(artifact.size)) throw new Error(`Artifact size mismatch: ${artifact.name}`);
    if (await sha256(artifactPath) !== artifact.sha256) throw new Error(`Artifact checksum mismatch: ${artifact.name}`);
  }
}

function artifactFor(manifest, kind) {
  const artifact = manifest.artifacts.find((item) => item.kind === kind);
  if (!artifact) throw new Error(`Backup manifest is missing ${kind}.`);
  return artifact;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const backupDirectory = path.resolve(requiredString(args['backup-dir'], 'backup-dir'));
  const envFile = path.resolve(String(args['env-file'] ?? '.env.docker'));
  const projectName = typeof args['project-name'] === 'string' ? args['project-name'] : undefined;
  const options = { envFile, projectName };
  const manifest = JSON.parse(await readFile(path.join(backupDirectory, 'manifest.json'), 'utf8'));
  if (manifest.format_version !== 1) throw new Error(`Unsupported backup format version: ${manifest.format_version}`);
  await verifyArtifacts(backupDirectory, manifest);

  const env = await loadEnvFile(envFile);
  const databaseUser = env.POSTGRES_USER || 'thpt_pct_pt';
  const sourceDatabase = databaseName(manifest.database, 'manifest.database');
  const encrypted = manifest.encryption?.enabled === true;
  const key = encrypted ? encryptionKey(false) : null;
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'thpt-pct-restore-'));
  const databaseDump = path.join(tempDirectory, 'database.dump');
  const uploadsArchive = path.join(tempDirectory, 'uploads.tar.gz');
  let backendPaused = false;

  try {
    const databaseArtifact = artifactFor(manifest, 'postgres-custom-dump');
    const uploadsArtifact = artifactFor(manifest, 'uploads-tar-gzip');
    if (encrypted) {
      await decryptFile(resolveInside(backupDirectory, databaseArtifact.name), databaseDump, key);
      await decryptFile(resolveInside(backupDirectory, uploadsArtifact.name), uploadsArchive, key);
    } else {
      await copyFile(resolveInside(backupDirectory, databaseArtifact.name), databaseDump);
      await copyFile(resolveInside(backupDirectory, uploadsArtifact.name), uploadsArchive);
    }

    await streamInput('docker', composeArgs(options, ['exec', '-T', 'postgres', 'pg_restore', '--list']), databaseDump, true);
    await streamInput('docker', ['run', '--rm', '-i', 'alpine:3.23', 'tar', '-tzf', '-'], uploadsArchive, true);
    console.log('Backup checksum, encryption authentication, pg_dump catalog and upload archive verified.');

    if (args['verify-only'] === true) return;
    const targetDatabase = databaseName(args['target-db'], 'target-db');
    const inPlace = targetDatabase === sourceDatabase;
    if (inPlace && (args['allow-in-place'] !== true || process.env.RESTORE_CONFIRM_DATABASE !== sourceDatabase)) {
      throw new Error('In-place restore requires --allow-in-place and RESTORE_CONFIRM_DATABASE matching the source database.');
    }
    if (args['restore-uploads'] === true && !inPlace) {
      throw new Error('--restore-uploads is only allowed with an explicitly confirmed in-place restore.');
    }

    if (inPlace) {
      run('docker', composeArgs(options, ['pause', 'backend']));
      backendPaused = true;
    }
    const adminArgs = ['exec', '-T', 'postgres', 'psql', '--username', databaseUser, '--dbname', 'postgres', '--set', 'ON_ERROR_STOP=1'];
    run('docker', composeArgs(options, [...adminArgs, '--command', `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${targetDatabase}' AND pid <> pg_backend_pid();`]));
    run('docker', composeArgs(options, [...adminArgs, '--command', `DROP DATABASE IF EXISTS "${targetDatabase}";`]));
    run('docker', composeArgs(options, [...adminArgs, '--command', `CREATE DATABASE "${targetDatabase}" TEMPLATE template0;`]));
    await streamInput('docker', composeArgs(options, [
      'exec', '-T', 'postgres', 'pg_restore', '--username', databaseUser,
      '--dbname', targetDatabase, '--no-owner', '--no-privileges', '--exit-on-error',
    ]), databaseDump);

    const restoredCounts = JSON.parse(run('docker', composeArgs(options, [
      'exec', '-T', 'postgres', 'psql', '--username', databaseUser,
      '--dbname', targetDatabase, '--tuples-only', '--no-align', '--command', countSql(),
    ]), { capture: true }));
    for (const table of COUNT_TABLES) {
      if (Number(restoredCounts[table]) !== Number(manifest.table_counts?.[table])) {
        throw new Error(`Restored row count mismatch for ${table}: expected ${manifest.table_counts?.[table]}, received ${restoredCounts[table]}.`);
      }
    }

    if (args['restore-uploads'] === true) {
      const backendContainer = run('docker', composeArgs(options, ['ps', '-q', 'backend']), { capture: true });
      await streamInput('docker', [
        'run', '--rm', '-i', '--volumes-from', backendContainer,
        'alpine:3.23', 'tar', '-C', '/app/backend', '-xzf', '-',
      ], uploadsArchive);
    }

    console.log(`Restore drill and integrity counts passed for database ${targetDatabase}.`);
    if (args['drop-target-after-verify'] === true && !inPlace) {
      run('docker', composeArgs(options, [...adminArgs, '--command', `DROP DATABASE "${targetDatabase}" WITH (FORCE);`]));
      console.log(`Dropped isolated restore database ${targetDatabase}.`);
    }
  } finally {
    if (backendPaused) {
      try { run('docker', composeArgs(options, ['unpause', 'backend'])); } catch { console.error('Failed to unpause backend after restore.'); }
    }
    await rm(tempDirectory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`Restore failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
