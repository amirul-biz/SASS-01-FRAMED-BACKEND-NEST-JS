import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../config/database/prisma.service';
import type { Prisma } from '../../../../generated/prisma/client';
import { PaymentProvider } from '../../../../generated/prisma/enums';
import {
  COMMISSION_CHARGE_INCLUDE,
  CommissionChargeWithDetailPayload,
} from '../../../commission/commission-config/commission-charge.include';

const AUDIT_LOG_INCLUDE = {
  payment: {
    select: {
      provider: true,
      bill: {
        select: {
          cashDetail: {
            select: {
              notes: true,
              recordedByUserPlatform: {
                select: {
                  photographerProfile: { select: { name: true } },
                  adminProfile: { select: { name: true } },
                },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.MerchantTransactionAuditLogInclude;

export type AuditLogWithPaymentPayload =
  Prisma.MerchantTransactionAuditLogGetPayload<{
    include: typeof AUDIT_LOG_INCLUDE;
  }>;

@Injectable()
export class OrderHistoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getAuditLogsByOrderId(
    orderId: string,
  ): Promise<AuditLogWithPaymentPayload[]> {
    return await this.prisma.merchantTransactionAuditLog.findMany({
      where: { orderId },
      include: AUDIT_LOG_INCLUDE,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  async getLatestCommissionChargeByOrderId(
    orderId: string,
  ): Promise<CommissionChargeWithDetailPayload | null> {
    return await this.prisma.commissionCharge.findFirst({
      where: { payment: { orderId } },
      orderBy: { commissionImposedAt: 'desc' },
      include: COMMISSION_CHARGE_INCLUDE,
    });
  }

  // Cheap enrichment for the History modal — the bill code was already written at checkout time,
  // this just surfaces it. No new storage; ToyyibPay-only (null for cash, which has no bill code).
  async getToyyibPayBillCodeByOrderId(orderId: string): Promise<string | null> {
    const payment = await this.prisma.merchantPayment.findFirst({
      where: { orderId, provider: PaymentProvider.TOYYIBPAY },
      select: {
        bill: { select: { toyyibPayDetail: { select: { billCode: true } } } },
      },
    });
    return payment?.bill?.toyyibPayDetail?.billCode ?? null;
  }
}
