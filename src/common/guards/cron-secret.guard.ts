import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class CronSecretGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const expectedSecret = process.env.CRON_SECRET;

    if (!expectedSecret) {
      throw new UnauthorizedException('CRON_SECRET is not configured');
    }

    if (request.headers['x-cron-secret'] !== expectedSecret) {
      throw new UnauthorizedException('Invalid or missing cron secret');
    }

    return true;
  }
}
