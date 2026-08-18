import { UnauthorizedException } from '@nestjs/common';
import { getAuth } from 'firebase-admin/auth';
import { FirebaseAuthGuard } from './firebase-auth.guard';

jest.mock('firebase-admin/auth', () => ({ getAuth: jest.fn() }));

describe('FirebaseAuthGuard', () => {
  let prisma: { user: { findUnique: jest.Mock } };
  let guard: FirebaseAuthGuard;
  let verifyIdToken: jest.Mock;

  function makeContext(headers: Record<string, string> = {}) {
    const request: any = { headers };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
      __request: request,
    } as any;
  }

  beforeEach(() => {
    verifyIdToken = jest.fn();
    (getAuth as jest.Mock).mockReturnValue({ verifyIdToken });
    prisma = { user: { findUnique: jest.fn() } };
    guard = new FirebaseAuthGuard(prisma as any);
  });

  it('throws UnauthorizedException when no bearer token is present', async () => {
    const context = makeContext();
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it("loads dbUser with each user platform's nested photographerProfile", async () => {
    verifyIdToken.mockResolvedValue({ uid: 'firebase-1' });
    const dbUser = {
      id: 'user-1',
      firebaseId: 'firebase-1',
      userPlatforms: [
        { id: 'platform-1', role: 'PHOTOGRAPHER', photographerProfile: { id: 'photographer-1' } },
      ],
    };
    prisma.user.findUnique.mockResolvedValue(dbUser);
    const context = makeContext({ authorization: 'Bearer token-123' });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { firebaseId: 'firebase-1' },
      include: { userPlatforms: { include: { photographerProfile: true } } },
    });
    expect((context as any).__request.dbUser).toEqual(dbUser);
  });
});
