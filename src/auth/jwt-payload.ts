import { UserRole } from '../generated/prisma/client';

export interface JwtPayload {
  sub: string;
  phone: string;
  role: UserRole;
}
