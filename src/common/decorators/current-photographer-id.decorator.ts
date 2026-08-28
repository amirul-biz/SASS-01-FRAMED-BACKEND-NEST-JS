import {
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

export const currentPhotographerIdFactory = (
  _data: unknown,
  context: ExecutionContext,
): string => {
  const request = context.switchToHttp().getRequest();
  const dbUser = request.dbUser as
    | { userPlatforms: { role: string; photographerProfile: { id: string } | null }[] }
    | undefined;

  const photographerId = dbUser?.userPlatforms.find(
    (platform) => platform.role === 'PHOTOGRAPHER',
  )?.photographerProfile?.id;

  if (!photographerId) {
    throw new ForbiddenException('This account has no photographer profile');
  }

  return photographerId;
};

export const CurrentPhotographerId = createParamDecorator(
  currentPhotographerIdFactory,
);
