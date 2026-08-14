import type { DecodedIdToken } from 'firebase-admin/auth';
import type { User, UserPlatform } from '../../generated/prisma/client';

declare global {
  namespace Express {
    interface Request {
      dbUser?: User & { userPlatforms: UserPlatform[] };
      firebaseUser?: DecodedIdToken;
    }
  }
}
