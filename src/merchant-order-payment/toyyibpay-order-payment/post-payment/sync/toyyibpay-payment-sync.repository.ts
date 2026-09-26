import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/database/prisma.service';
import {
  PaymentBillStatus,
  PaymentProvider,
} from '../../../../../generated/prisma/enums';

const OPEN_PAYMENT_STATUSES: PaymentBillStatus[] = [
  PaymentBillStatus.PENDING,
  PaymentBillStatus.PROCESSING,
];

@Injectable()
export class ToyyibPayPaymentSyncRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getStaleOpenPaymentIds(olderThan: Date): Promise<string[]> {
    const payments = await this.prisma.merchantPayment.findMany({
      where: {
        provider: PaymentProvider.TOYYIBPAY,
        status: { in: OPEN_PAYMENT_STATUSES },
        createdAt: { lt: olderThan },
      },
      select: { id: true },
    });
    return payments.map((payment) => payment.id);
  }
}
