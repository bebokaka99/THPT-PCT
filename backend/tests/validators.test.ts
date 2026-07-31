import { describe, expect, it } from 'vitest';
import { validateLoginInput } from '../src/modules/auth/auth.validation.js';
import {
  validateCreatePost,
  validateListPostsQuery,
} from '../src/modules/posts/post.validation.js';
import {
  validateCreateUser,
  validateBulkCreateStudents,
} from '../src/modules/users/user.validation.js';
import { validateUpdateMyProfile } from '../src/modules/profiles/profile.validation.js';
import {
  validateCreateEvent,
  validateListEventsQuery,
} from '../src/modules/events/event.validation.js';
import {
  asRecord,
  optionalString,
  parsePositiveInteger,
} from '../src/validators/common.js';

describe('shared validators', () => {
  it('rejects non-object request bodies', () => {
    expect(() => asRecord(null)).toThrow('Request body is required');
    expect(() => asRecord([])).toThrow('Request body is required');
  });

  it('normalizes optional strings and positive integers', () => {
    expect(optionalString('  school  ', 'name')).toBe('school');
    expect(optionalString('   ', 'name')).toBeUndefined();
    expect(parsePositiveInteger(undefined, 10, 'page')).toBe(10);
    expect(() => parsePositiveInteger('0', 10, 'page')).toThrow(
      'page must be a positive integer',
    );
  });
});

describe('auth validation', () => {
  it('accepts identifier aliases and trims the identifier', () => {
    expect(validateLoginInput({ email: ' admin@pct.local ', password: 'secret' })).toEqual({
      identifier: 'admin@pct.local',
      password: 'secret',
    });
    expect(validateLoginInput({ username: '21pct03090001', password: 'secret' }).identifier).toBe(
      '21pct03090001',
    );
  });

  it('requires an identifier and password', () => {
    expect(() => validateLoginInput({ password: 'secret' })).toThrow(
      'Username or email is required',
    );
    expect(() => validateLoginInput({ identifier: 'admin@pct.local' })).toThrow(
      'Password is required',
    );
  });
});

describe('post validation', () => {
  it('allows empty content and keeps the complete image gallery', () => {
    const input = validateCreatePost({
      title: 'Thông báo',
      content: null,
      post_images: [
        { image_url: '/uploads/images/one.png' },
        { image_url: 'https://cdn.example.com/two.png', caption: 'Hai' },
        { image_url: '/uploads/images/three.png', sort_order: 8 },
      ],
    });

    expect(input.content).toBe('');
    expect(input.post_images).toHaveLength(3);
    expect(input.post_images?.[1].caption).toBe('Hai');
    expect(input.post_images?.[2].sort_order).toBe(8);
  });

  it('rejects local image paths and deleted write status', () => {
    expect(() =>
      validateCreatePost({
        title: 'Invalid image',
        content: '',
        post_images: [{ image_url: './page_files/image.jpg' }],
      }),
    ).toThrow('post_images.image_url must be an http(s) URL or start with /uploads/');

    expect(() =>
      validateCreatePost({ title: 'Invalid status', status: 'deleted' }),
    ).toThrow('Allowed values: draft, published, archived');
    expect(validateListPostsQuery({ status: 'deleted' }).status).toBe('deleted');
  });
});

describe('user validation', () => {
  it('validates create user fields and normalizes roles', () => {
    expect(
      validateCreateUser({
        email: 'Teacher@pct.local',
        full_name: 'Teacher',
        password: 'Teacher123',
        roles: ['teacher', 'teacher', ''],
      }),
    ).toMatchObject({
      email: 'teacher@pct.local',
      roles: ['teacher'],
    });
  });

  it('validates bulk student limits and date format', () => {
    expect(() =>
      validateBulkCreateStudents({
        cohort: '2',
        students: [{ full_name: 'Student', date_of_birth: '03/09/2009' }],
      }),
    ).not.toThrow();

    expect(() =>
      validateBulkCreateStudents({
        cohort: '2',
        students: [{ full_name: 'Student', date_of_birth: '2009/09/03' }],
      }),
    ).toThrow('date_of_birth must use DD/MM/YYYY or YYYY-MM-DD');
  });
});

describe('profile validation', () => {
  it('accepts supported avatar URLs and normalized phone fields', () => {
    expect(
      validateUpdateMyProfile({
        phone: ' 0909 123 456 ',
        avatar_url: '/uploads/images/avatar.png',
        bio: ' Giáo viên ',
      }),
    ).toEqual({
      phone: '0909 123 456',
      avatar_url: '/uploads/images/avatar.png',
      bio: 'Giáo viên',
      parent_phone: undefined,
    });
  });

  it('rejects local avatar paths and invalid phone characters', () => {
    expect(() =>
      validateUpdateMyProfile({ avatar_url: 'C:\\photos\\avatar.png' }),
    ).toThrow('avatar_url must be an http(s) URL or start with /uploads/images/');
    expect(() => validateUpdateMyProfile({ phone: '0909<script>' })).toThrow(
      'phone contains invalid characters',
    );
  });
});

describe('event validation', () => {
  it('normalizes an event and defaults it to private scheduled state', () => {
    const event = validateCreateEvent({
      title: 'Lễ khai giảng',
      start_time: '2026-09-05T07:00:00+07:00',
      end_time: '2026-09-05T09:00:00+07:00',
      all_day: false,
    });
    expect(event.status).toBe('scheduled');
    expect(event.is_public).toBe(false);
    expect(event.start_time).toBeInstanceOf(Date);
  });

  it('rejects invalid ranges and caps event list limits', () => {
    expect(() =>
      validateCreateEvent({
        title: 'Invalid',
        start_time: '2026-09-05T09:00:00+07:00',
        end_time: '2026-09-05T07:00:00+07:00',
      }),
    ).toThrow('end_time must be after start_time');
    expect(validateListEventsQuery({ limit: '100' }).limit).toBe(50);
  });
});
