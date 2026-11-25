import { UserRole } from '@prisma/client';

export interface Actor {
  userId: string;
  role: UserRole;
  sessionId?: string;
}
