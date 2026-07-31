import {
  createRefreshSession,
  findActiveRefreshSession,
  findAuthUserByIdentifier,
  findAuthUserById,
  revokeRefreshSession,
  rotateRefreshSession,
} from './auth.repository.js';
import type { AuthUser, LoginInput, LoginResult } from './auth.types.js';
import { signAccessToken } from '../../utils/jwt.js';
import { comparePassword } from '../../utils/password.js';
import { HttpError } from '../../utils/http-error.js';
import {
  generateRefreshToken,
  getRefreshTokenExpiration,
  hashRefreshToken,
} from '../../utils/refresh-token.js';

function sanitizeUser(user: { passwordHash?: string; status?: string } & AuthUser): AuthUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    fullName: user.fullName,
    roles: user.roles,
    permissions: user.permissions,
  };
}

export async function login(input: LoginInput): Promise<LoginResult> {
  const user = await findAuthUserByIdentifier(input.identifier);

  if (!user || user.status !== 'active') {
    throw new HttpError(401, 'Invalid username/email or password');
  }

  const isPasswordValid = await comparePassword(input.password, user.passwordHash);

  if (!isPasswordValid) {
    throw new HttpError(401, 'Invalid username/email or password');
  }

  const refreshToken = generateRefreshToken();
  await createRefreshSession(
    user.id,
    hashRefreshToken(refreshToken),
    getRefreshTokenExpiration(),
  );

  return {
    accessToken: signAccessToken({ userId: user.id }),
    refreshToken,
    user: sanitizeUser(user),
  };
}

export async function getCurrentUser(userId: number): Promise<AuthUser> {
  const user = await findAuthUserById(userId);

  if (!user || user.status !== 'active') {
    throw new HttpError(401, 'User not found or inactive');
  }

  return sanitizeUser(user);
}

export async function refreshAuthSession(
  currentRefreshToken: string | null,
): Promise<LoginResult> {
  if (!currentRefreshToken) {
    throw new HttpError(401, 'Refresh session is required');
  }

  const currentTokenHash = hashRefreshToken(currentRefreshToken);
  const session = await findActiveRefreshSession(currentTokenHash);
  if (!session) {
    throw new HttpError(401, 'Refresh session is invalid or expired');
  }

  const user = await findAuthUserById(session.userId);
  if (!user || user.status !== 'active') {
    await revokeRefreshSession(currentTokenHash);
    throw new HttpError(401, 'User not found or inactive');
  }

  const refreshToken = generateRefreshToken();
  const rotated = await rotateRefreshSession({
    userId: user.id,
    currentTokenHash,
    nextTokenHash: hashRefreshToken(refreshToken),
    nextExpiresAt: getRefreshTokenExpiration(),
  });

  if (!rotated) {
    throw new HttpError(401, 'Refresh session is invalid or expired');
  }

  return {
    accessToken: signAccessToken({ userId: user.id }),
    refreshToken,
    user: sanitizeUser(user),
  };
}

export async function logout(currentRefreshToken: string | null) {
  if (!currentRefreshToken) return;
  await revokeRefreshSession(hashRefreshToken(currentRefreshToken));
}
