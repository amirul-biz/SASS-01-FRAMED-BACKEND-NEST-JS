import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { FirebaseAuthGuard } from '../../../../common/guards/firebase-auth.guard';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import { UserRole } from '../../../../../generated/prisma/enums';
import type { AuthenticatedUser } from '../../../../types/express';
import {
  SyncPaymentResult,
  ToyyibPayPaymentSyncService,
} from './toyyibpay-payment-sync.service';

@ApiTags('toyyibpay-order-payment')
@Controller('toyyibpay-order-payment/post-payment')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles(UserRole.PHOTOGRAPHER, UserRole.ADMIN)
export class ToyyibPayPaymentResyncController {
  constructor(
    private readonly toyyibPayPaymentSyncService: ToyyibPayPaymentSyncService,
  ) {}

  @Post(':paymentId/resync')
  async resyncPaymentAsPhotographer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('paymentId') paymentId: string,
  ): Promise<SyncPaymentResult> {
    return await this.toyyibPayPaymentSyncService.resyncAsPhotographer(
      user,
      paymentId,
    );
  }
}
