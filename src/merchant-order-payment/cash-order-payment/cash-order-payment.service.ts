import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OrderStatus,
  PaymentBillStatus,
  PaymentProvider,
} from '../../../generated/prisma/enums';
import type { AuthenticatedUser } from '../../types/express';
import { CommissionService } from '../../commission/commission-config/commission.service';
import { PaymentTransitionRepository } from '../core/payment-transition/payment-transition.repository';
import { MerchantPaymentPlatformService } from '../../merchant-payment-platform/merchant-payment-platform.service';
import {
  CashOrderPaymentResponseDto,
  MarkCashPaymentAsPaidDto,
} from './cash-order-payment.dto';
import {
  CashOrderPaymentRepository,
  MarkedAsPaidResult,
  PaymentForMarkingPayload,
} from './cash-order-payment.repository';

@Injectable()
export class CashOrderPaymentService {
  constructor(
    private readonly cashOrderPaymentRepository: CashOrderPaymentRepository,
    private readonly paymentTransitionRepository: PaymentTransitionRepository,
    private readonly merchantPaymentPlatformService: MerchantPaymentPlatformService,
    private readonly commissionService: CommissionService,
  ) {}

  async markCashPaymentAsPaid(
    user: AuthenticatedUser,
    paymentId: string,
    dto: MarkCashPaymentAsPaidDto,
  ): Promise<CashOrderPaymentResponseDto> {
    const payment =
      await this.paymentTransitionRepository.getPaymentForMarkingById(
        paymentId,
      );
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    const recordedByUserPlatformId =
      this.merchantPaymentPlatformService.getAuthorizedUserPlatformId(
        user,
        payment.merchantPaymentPlatformOption.userPlatformId,
      );
    if (!this.isCashPayment(payment)) {
      throw new BadRequestException('Only cash payments can be marked as paid');
    }
    if (!this.isPaymentAwaitingPayment(payment)) {
      throw new ConflictException(
        'This payment can no longer be marked as paid',
      );
    }

    const commission = await this.commissionService.getCommissionForPayment({
      paymentPlatformOptionId: payment.merchantPaymentPlatformOptionId,
      isImposeCommission:
        payment.merchantPaymentPlatformOption.isImposeCommission,
      order: {
        amountPaid: Number(payment.amount),
        itemPrices: payment.order.items.map((item) => Number(item.price)),
      },
    });

    const result = await this.cashOrderPaymentRepository.markPaymentAsPaid({
      payment,
      recordedByUserPlatformId,
      commission,
      notes: dto.notes,
    });
    if (!result) {
      throw new ConflictException('This payment has already been processed');
    }
    return this.getMappedCashOrderPaymentResponseDto(result);
  }

  private isCashPayment(payment: PaymentForMarkingPayload): boolean {
    return payment.provider === PaymentProvider.CASH;
  }

  private isPaymentAwaitingPayment(payment: PaymentForMarkingPayload): boolean {
    const isPaymentPending = payment.status === PaymentBillStatus.PENDING;
    const isOrderAwaitingConfirmation =
      payment.order.status === OrderStatus.PENDING_CONFIRMATION;

    return isPaymentPending && isOrderAwaitingConfirmation;
  }

  private getMappedCashOrderPaymentResponseDto(
    result: MarkedAsPaidResult,
  ): CashOrderPaymentResponseDto {
    return {
      id: result.payment.id,
      orderId: result.payment.orderId,
      provider: result.payment.provider,
      status: result.payment.status,
      amount: Number(result.payment.amount),
      orderStatus: result.orderStatus,
    };
  }
}
