import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { PrismaService } from 'src/config/database/prisma.service';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const decoded = await getAuth()
      .verifyIdToken(token)
      .catch(() => {
        throw new UnauthorizedException('Invalid or expired token');
      });

    const dbUser = await this.prisma.user.findUnique({
      where: { firebaseId: decoded.uid },
      include: { userPlatforms: true },
    });

    if (!dbUser) {
      throw new UnauthorizedException('User not registered');
    }

    request.firebaseUser = decoded;
    request.dbUser = dbUser;

    return true;
  }

  private extractToken(request: Request): string | undefined {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return undefined;
    }
    return header.slice('Bearer '.length);
  }
}
