export type AuthUser = {
  id: number;
  username: string | null;
  email: string | null;
  fullName: string;
  roles: string[];
  permissions: string[];
};

export type AuthUserRecord = AuthUser & {
  passwordHash: string;
  status: string;
};

export type LoginInput = {
  identifier: string;
  password: string;
};

export type LoginResult = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

export type RefreshSessionRecord = {
  userId: number;
};
