import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { FirebaseAuthGuard } from 'src/common/guards/firebase-auth.guard';
import type { User, UserPlatform } from '../../generated/prisma/client';
import { CurrentUserResponseDto } from './users.dto';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  @Get('current-user')
  @UseGuards(FirebaseAuthGuard)
  getCurrentUser(
    @CurrentUser() user: User & { userPlatforms: UserPlatform[] },
  ): CurrentUserResponseDto {
    return {
      id: user.id,
      email: user.email,
      roles: user.userPlatforms.map((platform) =>
        platform.role.toLowerCase(),
      ),
    };
  }
}
