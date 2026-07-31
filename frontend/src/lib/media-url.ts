import type { MediaFile, MediaVariant } from '../types/media';
import { publicEnv } from '../config/public-env';

export function resolvePublicMediaUrl(value?: string | null) {
  if (!value) return '';
  if (value.startsWith('http://') || value.startsWith('https://')) return value;

  try {
    const apiOrigin = new URL(
      publicEnv.apiBaseUrl,
      window.location.origin,
    ).origin;
    return new URL(value, apiOrigin).toString();
  } catch {
    return value;
  }
}

export function getMediaVariant(
  media: MediaFile,
  variant: 'thumbnail' | 'medium',
): MediaVariant | undefined {
  return media.variants?.[variant];
}

export function resolveMediaDisplayUrl(
  media: MediaFile,
  variant: 'thumbnail' | 'medium' = 'medium',
) {
  return resolvePublicMediaUrl(getMediaVariant(media, variant)?.url ?? media.url);
}
