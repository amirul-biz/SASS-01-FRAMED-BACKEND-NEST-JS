import type { DecodedIdToken } from 'firebase-admin/auth';
import type { User, UserPlatform } from '../../generated/prisma/client';

export type AuthenticatedUser = User & { userPlatforms: UserPlatform[] };

declare global {
  namespace Express {
    interface Request {
      dbUser?: AuthenticatedUser;
      firebaseUser?: DecodedIdToken;
    }
  }
}
