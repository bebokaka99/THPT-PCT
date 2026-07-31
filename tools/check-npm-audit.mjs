import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const exceptions = [
  {
    advisoryId: 'GHSA-qwww-vcr4-c8h2',
    packageName: 'react-router',
    installedVersion: '7.18.2',
    expiresOn: '2026-08-31',
    reason: 'The portal is a client-side SPA and does not enable React Router RSC mode or server actions.',
  },
];

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const auditResult = spawnSync(
  npmCommand,
  ['audit', '--omit=dev', '--audit-level=high', '--json'],
  {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    shell: process.platform === 'win32',
  },
);

if (auditResult.error) {
  throw auditResult.error;
}

if (!auditResult.stdout?.trim()) {
  process.stderr.write(auditResult.stderr ?? '');
  throw new Error('npm audit did not return a JSON report.');
}

const audit = JSON.parse(auditResult.stdout);
const vulnerabilities = Object.entries(audit.vulnerabilities ?? {}).filter(
  ([, vulnerability]) =>
    vulnerability.severity === 'high' || vulnerability.severity === 'critical',
);

if (vulnerabilities.length === 0) {
  console.log('Production dependency audit passed with no HIGH/CRITICAL findings.');
  process.exit(0);
}

const today = new Date().toISOString().slice(0, 10);
const approvedPackages = new Set();
const approvedAdvisories = [];
const failures = [];

for (const [packageName, vulnerability] of vulnerabilities) {
  for (const source of vulnerability.via ?? []) {
    if (typeof source === 'string') {
      continue;
    }

    const advisoryId = source.url?.split('/').pop();
    const exception = exceptions.find(
      (entry) =>
        entry.advisoryId === advisoryId &&
        entry.packageName === packageName,
    );

    if (!exception) {
      failures.push(`${packageName}: ${advisoryId ?? source.title}`);
      continue;
    }

    const packageJsonPath = path.join(
      process.cwd(),
      'node_modules',
      packageName,
      'package.json',
    );
    const installedVersion = JSON.parse(
      readFileSync(packageJsonPath, 'utf8'),
    ).version;

    if (installedVersion !== exception.installedVersion) {
      failures.push(
        `${packageName}: exception expects ${exception.installedVersion}, installed ${installedVersion}`,
      );
      continue;
    }

    if (today > exception.expiresOn) {
      failures.push(
        `${packageName}: exception ${exception.advisoryId} expired on ${exception.expiresOn}`,
      );
      continue;
    }

    approvedPackages.add(packageName);
    approvedAdvisories.push(exception);
  }
}

for (const [packageName, vulnerability] of vulnerabilities) {
  const unresolvedSources = (vulnerability.via ?? []).filter((source) => {
    if (typeof source === 'string') {
      return !approvedPackages.has(source);
    }

    const advisoryId = source.url?.split('/').pop();
    return !approvedAdvisories.some(
      (entry) =>
        entry.packageName === packageName &&
        entry.advisoryId === advisoryId,
    );
  });

  if (unresolvedSources.length > 0 || (vulnerability.via ?? []).length === 0) {
    failures.push(`${packageName}: unresolved HIGH/CRITICAL dependency path`);
  }
}

if (failures.length > 0) {
  console.error('Production dependency audit failed:');
  for (const failure of [...new Set(failures)]) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

for (const exception of approvedAdvisories) {
  console.warn(
    `Approved temporary exception: ${exception.advisoryId} in ${exception.packageName}@${exception.installedVersion}; expires ${exception.expiresOn}.`,
  );
}
console.log('Production dependency audit passed with documented exceptions only.');
