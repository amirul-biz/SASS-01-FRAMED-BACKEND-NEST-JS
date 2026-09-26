import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { CommissionCalculatorRegistry } from './commission-calculator.registry';
import type {
  CommissionCalculation,
  CommissionOrderBasis,
} from './commission.interface';
import {
  CommissionPlanPayload,
  CommissionRepository,
} from './commission.repository';

export interface CommissionForPaymentParams {
  paymentPlatformOptionId: string;
  isImposeCommission: boolean;
  order: CommissionOrderBasis;
}

@Injectable()
export class CommissionService {
  constructor(
    private readonly commissionRepository: CommissionRepository,
    private readonly commissionCalculatorRegistry: CommissionCalculatorRegistry,
  ) {}

  async getCommissionForPayment(
    params: CommissionForPaymentParams,
  ): Promise<CommissionCalculation | null> {
    if (!params.isImposeCommission) {
      return null;
    }

    const plan = await this.getApplicablePlan(params.paymentPlatformOptionId);
    if (!plan) {
      return null;
    }

    const calculator = this.commissionCalculatorRegistry.getCalculator(
      plan.type,
    );
    const value = calculator.getPlanValue(plan);
    const isValueMissing = value === null;
    if (isValueMissing) {
      throw new InternalServerErrorException(
        `Commission plan ${plan.id} has no value for its type ${plan.type}`,
      );
    }

    const breakdown = calculator.calculate(value, params.order);
    const isNoCommissionOwed = breakdown.commissionAmount <= 0;
    if (isNoCommissionOwed) {
      return null;
    }
    return {
      ...breakdown,
      commissionPlanId: plan.id,
      originalPaymentAmount: params.order.amountPaid,
    };
  }

  async getToyyibPaySplitRecipient(
    paymentPlatformOptionId: string,
  ): Promise<string | null> {
    return await this.commissionRepository.getToyyibPaySplitRecipientForOption(
      paymentPlatformOptionId,
    );
  }

  private async getApplicablePlan(
    paymentPlatformOptionId: string,
  ): Promise<CommissionPlanPayload | null> {
    const assignedPlan =
      await this.commissionRepository.getActivePlanAssignedToOption(
        paymentPlatformOptionId,
      );
    const isPlanAssigned = assignedPlan !== null;
    if (isPlanAssigned) {
      return assignedPlan;
    }
    return await this.commissionRepository.getDefaultActivePlan();
  }
}
