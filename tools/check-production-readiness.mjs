import { lookup } from 'node:dns/promises';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import tls from 'node:tls';
import { parseArgs, positiveInteger, requiredString } from './backup-lib.mjs';

function tlsCertificate(hostname, port, timeoutMs) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host: hostname, port, servername: hostname, rejectUnauthorized: true });
    const timer = setTimeout(() => socket.destroy(new Error('TLS connection timed out.')), timeoutMs);
    socket.once('secureConnect', () => {
      clearTimeout(timer);
      const certificate = socket.getPeerCertificate();
      socket.end();
      resolve(certificate);
    });
    socket.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    redirect: options.redirect ?? 'follow',
    signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
    headers: { accept: 'application/json, text/html;q=0.9' },
  });
  return response;
}

function assertHeader(response, name, predicate, message) {
  const value = response.headers.get(name) || '';
  if (!predicate(value)) throw new Error(`${message} Received ${name}: ${value || '<missing>'}`);
  return value;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = new URL(requiredString(args.url ?? process.env.APP_URL, 'url'));
  const allowHttp = args['allow-http'] === true;
  const timeoutMs = positiveInteger(args['timeout-ms'], 10_000, 'timeout-ms');
  if (!allowHttp && baseUrl.protocol !== 'https:') throw new Error('Production readiness URL must use HTTPS.');
  if (baseUrl.pathname !== '/' || baseUrl.search || baseUrl.hash) throw new Error('Readiness URL must be an origin.');

  const report = {
    checked_at: new Date().toISOString(),
    origin: baseUrl.origin,
    dns_addresses: [],
    tls: null,
    checks: [],
  };
  const addresses = await lookup(baseUrl.hostname, { all: true });
  report.dns_addresses = addresses.map((entry) => ({ address: entry.address, family: entry.family }));
  if (!addresses.length) throw new Error('Domain has no DNS address.');

  if (baseUrl.protocol === 'https:') {
    const certificate = await tlsCertificate(baseUrl.hostname, Number(baseUrl.port || 443), timeoutMs);
    const expiresAt = new Date(certificate.valid_to);
    const daysRemaining = Math.floor((expiresAt.getTime() - Date.now()) / 86_400_000);
    if (!Number.isFinite(daysRemaining) || daysRemaining < 14) {
      throw new Error(`TLS certificate expires too soon (${daysRemaining} days remaining).`);
    }
    report.tls = { subject: certificate.subject?.CN ?? null, issuer: certificate.issuer?.CN ?? null, expires_at: expiresAt.toISOString(), days_remaining: daysRemaining };

    const httpUrl = new URL(baseUrl);
    httpUrl.protocol = 'http:';
    httpUrl.port = '';
    const redirect = await request(httpUrl, { redirect: 'manual', timeoutMs });
    const location = redirect.headers.get('location') || '';
    if (![301, 302, 307, 308].includes(redirect.status) || !location.startsWith(`https://${baseUrl.host}`)) {
      throw new Error(`HTTP must redirect to the canonical HTTPS origin; received ${redirect.status} ${location}.`);
    }
    report.checks.push({ name: 'http_to_https', status: 'passed' });
  }

  const portal = await request(baseUrl, { timeoutMs });
  if (!portal.ok) throw new Error(`Portal returned HTTP ${portal.status}.`);
  assertHeader(portal, 'content-security-policy', (value) => value.includes("default-src 'self'"), 'Content-Security-Policy is missing or unsafe.');
  assertHeader(portal, 'x-content-type-options', (value) => value.toLowerCase() === 'nosniff', 'X-Content-Type-Options must be nosniff.');
  assertHeader(portal, 'x-frame-options', (value) => value.toUpperCase() === 'DENY', 'X-Frame-Options must be DENY.');
  if (baseUrl.protocol === 'https:') {
    assertHeader(portal, 'strict-transport-security', (value) => /max-age=\d+/.test(value), 'HSTS is required over HTTPS.');
  }
  report.checks.push({ name: 'portal_security_headers', status: 'passed' });

  for (const endpoint of ['/api/health/live', '/api/health/ready']) {
    const response = await request(new URL(endpoint, baseUrl), { timeoutMs });
    const body = await response.json().catch(() => null);
    if (!response.ok || body?.status !== 'ok') throw new Error(`${endpoint} is not healthy.`);
    if (endpoint.endsWith('/ready') && (body?.readiness !== 'ready' || body?.database?.status !== 'connected')) {
      throw new Error('Readiness check did not confirm the database connection.');
    }
    report.checks.push({ name: endpoint, status: 'passed' });
  }

  if (typeof args.report === 'string') {
    const reportPath = path.resolve(args.report);
    await mkdir(path.dirname(reportPath), { recursive: true });
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(`Production readiness passed for ${baseUrl.origin}.`);
}

main().catch((error) => {
  console.error(`Production readiness failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
