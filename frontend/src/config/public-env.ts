function readApiBaseUrl() {
  const value = import.meta.env.VITE_API_BASE_URL?.trim() ||
    'http://localhost:4000/api';

  if (value.startsWith('/') && !value.startsWith('//')) {
    return value.replace(/\/+$/, '');
  }

  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
    return value.replace(/\/+$/, '');
  } catch {
    throw new Error(
      'VITE_API_BASE_URL must be an absolute HTTP(S) URL or a root-relative path',
    );
  }
}

function readPublicSiteUrl() {
  const value = import.meta.env.VITE_PUBLIC_SITE_URL?.trim();
  if (!value) return undefined;

  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
    return parsed.origin;
  } catch {
    throw new Error('VITE_PUBLIC_SITE_URL must be a valid HTTP(S) origin');
  }
}

export const publicEnv = Object.freeze({
  apiBaseUrl: readApiBaseUrl(),
  publicSiteUrl: readPublicSiteUrl(),
});
