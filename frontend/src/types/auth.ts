export type AuthUser = {
  id: number;
  username: string | null;
  email: string | null;
  fullName: string;
  roles: string[];
  permissions: string[];
};

export type LoginResponse = {
  accessToken: string;
  user: AuthUser;
};

export type MeResponse = {
  user: AuthUser;
};

export type RefreshSessionResponse = LoginResponse;
