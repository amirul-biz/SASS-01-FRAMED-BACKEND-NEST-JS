import {
  Body,
  Controller,
  Param,
  Patch,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '../../../generated/prisma/enums';
import type { AuthenticatedUser } from '../../types/express';
import {
  CashOrderPaymentResponseDto,
  MarkCashPaymentAsPaidDto,
} from './cash-order-payment.dto';
import { CashOrderPaymentService } from './cash-order-payment.service';

@ApiTags('cash-order-payments')
@Controller('cash-order-payments')
@UsePipes(new ValidationPipe({ transform: true }))
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles(UserRole.PHOTOGRAPHER, UserRole.ADMIN)
export class CashOrderPaymentController {
  constructor(
    private readonly cashOrderPaymentService: CashOrderPaymentService,
  ) {}

  @Patch(':paymentId/mark-as-paid')
  async markCashPaymentAsPaid(
    @CurrentUser() user: AuthenticatedUser,
    @Param('paymentId') paymentId: string,
    @Body() dto: MarkCashPaymentAsPaidDto,
  ): Promise<CashOrderPaymentResponseDto> {
    return await this.cashOrderPaymentService.markCashPaymentAsPaid(
      user,
      paymentId,
      dto,
    );
  }
}
