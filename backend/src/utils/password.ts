import bcrypt from 'bcryptjs';

const saltRounds = 10;

export function hashPassword(password: string) {
  return bcrypt.hash(password, saltRounds);
}

export function comparePassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

