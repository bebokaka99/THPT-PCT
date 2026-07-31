import { asRecord } from '../../validators/common.js';
import { HttpError } from '../../utils/http-error.js';
import type { LoginInput } from './auth.types.js';

export function validateLoginInput(body: unknown): LoginInput {
  const input = asRecord(body);
  const identifier = typeof input.identifier === 'string'
    ? input.identifier.trim()
    : typeof input.email === 'string'
      ? input.email.trim()
      : typeof input.username === 'string'
        ? input.username.trim()
        : '';
  const password = typeof input.password === 'string' ? input.password : '';

  if (!identifier) {
    throw new HttpError(400, 'Username or email is required');
  }

  if (!password) {
    throw new HttpError(400, 'Password is required');
  }

  return {
    identifier,
    password,
  };
}
