import { Injectable } from '@nestjs/common';
import type { MerchantPayment } from '../../../../generated/prisma/client';
import {
  TransitionSource,
  PaymentBillStatus,
} from '../../../../generated/prisma/enums';
import type { CommissionChargeWithDetailPayload } from '../../../commission/commission-config/commission-charge.include';
import type {
  OrderCommissionDto,
  OrderHistoryEntryDto,
  OrderPaymentDto,
} from '../../../order/order.dto';
import {
  AuditLogWithPaymentPayload,
  OrderHistoryRepository,
} from './order-history.repository';

export type PaymentWithCommission = MerchantPayment & {
  commissionCharge: CommissionChargeWithDetailPayload | null;
};

@Injectable()
export class OrderHistoryService {
  constructor(
    private readonly orderHistoryRepository: OrderHistoryRepository,
  ) {}

  async getOrderHistoryEntries(
    orderId: string,
  ): Promise<OrderHistoryEntryDto[]> {
    const auditLogs =
      await this.orderHistoryRepository.getAuditLogsByOrderId(orderId);
    return auditLogs.map((auditLog) =>
      this.getMappedOrderHistoryEntryDto(auditLog),
    );
  }

  private getMappedOrderHistoryEntryDto(
    auditLog: AuditLogWithPaymentPayload,
  ): OrderHistoryEntryDto {
    const isManualPaidTransition =
      auditLog.source === TransitionSource.MANUAL &&
      auditLog.toStatus === PaymentBillStatus.PAID;
    const cashDetail = isManualPaidTransition
      ? auditLog.payment.bill?.cashDetail
      : undefined;
    const recorder = cashDetail?.recordedByUserPlatform;

    return {
      id: auditLog.id,
      createdAt: auditLog.createdAt,
      source: auditLog.source,
      provider: auditLog.payment.provider,
      fromPaymentStatus: auditLog.fromStatus,
      toPaymentStatus: auditLog.toStatus,
      fromOrderStatus: auditLog.fromOrderStatus,
      toOrderStatus: auditLog.toOrderStatus,
      note: cashDetail?.notes ?? null,
      recordedBy:
        recorder?.photographerProfile?.name ??
        recorder?.adminProfile?.name ??
        null,
    };
  }

  async getOrderPaymentBillCode(orderId: string): Promise<string | null> {
    return await this.orderHistoryRepository.getToyyibPayBillCodeByOrderId(
      orderId,
    );
  }

  async getOrderCommission(
    orderId: string,
  ): Promise<OrderCommissionDto | null> {
    const commissionCharge =
      await this.orderHistoryRepository.getLatestCommissionChargeByOrderId(
        orderId,
      );
    return commissionCharge
      ? this.getMappedOrderCommissionDto(commissionCharge)
      : null;
  }

  getMappedOrderPaymentDto(payment: PaymentWithCommission): OrderPaymentDto {
    return {
      id: payment.id,
      provider: payment.provider,
      status: payment.status,
      amount: Number(payment.amount),
      commission: payment.commissionCharge
        ? this.getMappedOrderCommissionDto(payment.commissionCharge)
        : null,
      // Only ever set right after checkout, directly on OrderService's own response — never
      // known at this generic read-mapping layer.
      paymentUrl: null,
    };
  }

  private getMappedOrderCommissionDto(
    commissionCharge: CommissionChargeWithDetailPayload,
  ): OrderCommissionDto {
    const { percentagePerTransaction, amountPerTransaction } = commissionCharge;
    const { percentagePerUnit, amountPerUnit } = commissionCharge;

    return {
      commissionType: commissionCharge.commissionType,
      originalPaymentAmount: Number(commissionCharge.originalPaymentAmount),
      commissionBaseAmount: Number(commissionCharge.commissionBaseAmount),
      percentageRateApplied: this.getNumberOrNull(
        percentagePerTransaction?.percentageRateApplied ??
          percentagePerUnit?.percentageRateApplied,
      ),
      flatAmountApplied: this.getNumberOrNull(
        amountPerTransaction?.flatAmountApplied,
      ),
      commissionPerUnitApplied: this.getNumberOrNull(
        amountPerUnit?.commissionPerUnitApplied,
      ),
      unitCount:
        percentagePerUnit?.unitCount ?? amountPerUnit?.unitCount ?? null,
      totalUnitCost: this.getNumberOrNull(
        percentagePerUnit?.totalUnitCost ?? amountPerUnit?.totalUnitCost,
      ),
      averageCostPerUnit: this.getNumberOrNull(
        percentagePerUnit?.averageCostPerUnit ??
          amountPerUnit?.averageCostPerUnit,
      ),
      averageCommissionPerUnit: this.getNumberOrNull(
        percentagePerUnit?.averageCommissionPerUnit ??
          (amountPerUnit ? amountPerUnit.commissionPerUnitApplied : undefined),
      ),
      commissionAmount: Number(commissionCharge.commissionAmount),
      commissionImposedAt: commissionCharge.commissionImposedAt,
    };
  }

  private getNumberOrNull(
    value: { toString(): string } | undefined,
  ): number | null {
    return value === undefined ? null : Number(value);
  }
}
