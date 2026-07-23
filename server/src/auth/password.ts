import bcrypt from "bcryptjs";

const saltRounds = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, saltRounds);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
