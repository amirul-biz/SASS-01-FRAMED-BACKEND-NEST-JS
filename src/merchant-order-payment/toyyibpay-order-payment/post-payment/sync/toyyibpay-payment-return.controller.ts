import { Body, Controller, Param, Post } from '@nestjs/common';
import { ConfirmToyyibPayReturnDto } from './toyyibpay-return.dto';
import {
  ConfirmToyyibPayReturnResult,
  ToyyibPayPaymentSyncService,
} from './toyyibpay-payment-sync.service';


@Controller('toyyibpay-order-payment/post-payment')
export class ToyyibPayPaymentReturnController {
  constructor(
    private readonly toyyibPayPaymentSyncService: ToyyibPayPaymentSyncService,
  ) {}

  @Post(':paymentId/confirm-return')
  async confirmReturnAsCustomer(
    @Param('paymentId') paymentId: string,
    @Body() dto: ConfirmToyyibPayReturnDto,
  ): Promise<ConfirmToyyibPayReturnResult> {
    return await this.toyyibPayPaymentSyncService.confirmReturnAsCustomer(
      paymentId,
      dto.billCode,
    );
  }
}
