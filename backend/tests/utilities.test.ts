import { describe, expect, it } from 'vitest';
import { signAccessToken, verifyAccessToken } from '../src/utils/jwt.js';
import { HttpError } from '../src/utils/http-error.js';
import { hashPassword, comparePassword } from '../src/utils/password.js';
import { sanitizeRichHtml } from '../src/utils/sanitize-html.js';
import { slugify } from '../src/utils/slug.js';
import {
  generateRefreshToken,
  hashRefreshToken,
} from '../src/utils/refresh-token.js';

describe('utility functions', () => {
  it('creates stable Vietnamese slugs', () => {
    expect(slugify('Trường THPT Phan Chu Trinh')).toBe('truong-thpt-phan-chu-trinh');
    expect(slugify('  Tin mới / 2026  ')).toBe('tin-moi-2026');
  });

  it('keeps HttpError status code', () => {
    const error = new HttpError(403, 'Permission denied');
    expect(error).toBeInstanceOf(Error);
    expect(error.statusCode).toBe(403);
    expect(error.message).toBe('Permission denied');
  });

  it('hashes and compares passwords', async () => {
    const hash = await hashPassword('admin123');
    expect(hash).not.toBe('admin123');
    expect(await comparePassword('admin123', hash)).toBe(true);
    expect(await comparePassword('wrong-password', hash)).toBe(false);
  });

  it('signs and verifies access tokens', () => {
    const token = signAccessToken({ userId: 42 });
    expect(verifyAccessToken(token)).toEqual({ userId: 42 });
    expect(() => verifyAccessToken('invalid.token.value')).toThrow('Invalid or expired token');
  });

  it('generates opaque refresh tokens and stable hashes', () => {
    const token = generateRefreshToken();
    expect(token.length).toBeGreaterThanOrEqual(64);
    expect(hashRefreshToken(token)).toHaveLength(64);
    expect(hashRefreshToken(token)).toBe(hashRefreshToken(token));
    expect(hashRefreshToken(generateRefreshToken())).not.toBe(hashRefreshToken(token));
  });

  it('sanitizes scripts and local image paths while keeping uploads', () => {
    const html = sanitizeRichHtml(
      '<p>Hello</p><script>alert(1)</script><img src="file:///tmp/a.png"><img src="/uploads/images/a.png">',
    );

    expect(html).toContain('<p>Hello</p>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('file:///');
    expect(html).toContain('/uploads/images/a.png');
  });
});
