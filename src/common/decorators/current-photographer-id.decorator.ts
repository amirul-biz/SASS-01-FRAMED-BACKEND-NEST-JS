import {
  BadRequestException,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';

export const currentPhotographerIdFactory = (
    _data: unknown,
    context: ExecutionContext,
): string => {
    const request = context.switchToHttp().getRequest();
    const header = request.headers?.['x-photographer-id'];

    if (typeof header !== 'string' || header.trim() === '') {
        throw new BadRequestException(
            'Missing x-photographer-id header (temporary stand-in until real auth is wired up)',
        );
    }

    return header;
};

export const CurrentPhotographerId = createParamDecorator(
    currentPhotographerIdFactory,
);
