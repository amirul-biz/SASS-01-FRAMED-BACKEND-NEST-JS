import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { currentPhotographerIdFactory } from './current-photographer-id.decorator';

function makeContext(dbUser?: unknown) {
  const request = { dbUser };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('currentPhotographerIdFactory', () => {
  it('returns the photographer profile id for a PHOTOGRAPHER platform', () => {
    const context = makeContext({
      userPlatforms: [
        { role: 'PHOTOGRAPHER', photographerProfile: { id: 'photographer-1' } },
      ],
    });

    expect(currentPhotographerIdFactory(undefined, context)).toBe('photographer-1');
  });

  it('throws ForbiddenException when the user has no PHOTOGRAPHER platform', () => {
    const context = makeContext({
      userPlatforms: [{ role: 'ADMIN', photographerProfile: null }],
    });

    expect(() => currentPhotographerIdFactory(undefined, context)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when there is no authenticated user on the request', () => {
    const context = makeContext(undefined);

    expect(() => currentPhotographerIdFactory(undefined, context)).toThrow(ForbiddenException);
  });
});
