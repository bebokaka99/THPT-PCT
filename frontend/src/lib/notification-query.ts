export const notificationKeys = {
  all: ['notifications'] as const,
  latest: (userId?: number) =>
    ['notifications', 'latest', userId ?? 'anonymous'] as const,
  list: (userId: number | undefined, page: number, unread: boolean) =>
    ['notifications', 'list', userId ?? 'anonymous', page, unread] as const,
  unreadCount: (userId?: number) =>
    ['notifications', 'unread-count', userId ?? 'anonymous'] as const,
};

export function getNotificationDestination(value: string | null) {
  if (!value) return null;
  if (value.startsWith('/') && !value.startsWith('//')) {
    return { kind: 'internal' as const, url: value };
  }

  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? { kind: 'external' as const, url: url.toString() }
      : null;
  } catch {
    return null;
  }
}
