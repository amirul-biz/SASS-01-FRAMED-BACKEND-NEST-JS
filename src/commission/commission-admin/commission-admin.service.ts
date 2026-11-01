import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  CommissionType,
  PaymentProvider,
} from '../../../generated/prisma/enums';
import { CommissionCalculatorRegistry } from '../commission-config/commission-calculator.registry';
import {
  AssignCommissionPlanDto,
  CommissionAssignmentQueryDto,
  CommissionAssignmentRowDto,
  CommissionPlanDto,
  CommissionReportChargeRowDto,
  CommissionReportPhotographerRowDto,
  CommissionReportQueryDto,
  CommissionReportResponseDto,
  CreateCommissionPlanDto,
  PaginatedCommissionAssignmentsDto,
  UpdateCommissionPlanDto,
} from './commission-admin.dto';
import {
  CommissionAdminPlanPayload,
  CommissionAdminRepository,
  CommissionAssignmentRowPayload,
  CommissionReportPaymentPayload,
} from './commission-admin.repository';
import { roundToCents } from '../../order/order-pricing.util';

const MAX_PERCENTAGE = 100;
const END_OF_DAY_SUFFIX = 'T23:59:59.999Z';
const BARE_DATE_LENGTH = 'YYYY-MM-DD'.length;

@Injectable()
export class CommissionAdminService {
  constructor(
    private readonly commissionAdminRepository: CommissionAdminRepository,
    private readonly commissionCalculatorRegistry: CommissionCalculatorRegistry,
  ) {}

  async getPlans(): Promise<CommissionPlanDto[]> {
    const plans = await this.commissionAdminRepository.getPlans();
    return plans.map((plan) => this.getMappedCommissionPlanDto(plan));
  }

  async createPlan(dto: CreateCommissionPlanDto): Promise<CommissionPlanDto> {
    this.assertValueAllowedForType(dto.type, dto.value);

    const plan = await this.commissionAdminRepository.createPlan({
      name: dto.name,
      type: dto.type,
      provider: dto.provider ?? null,
      isDefault: dto.isDefault ?? false,
      value: dto.value,
    });
    return this.getMappedCommissionPlanDto(plan);
  }

  async updatePlan(
    planId: string,
    dto: UpdateCommissionPlanDto,
  ): Promise<CommissionPlanDto> {
    const existingPlan =
      await this.commissionAdminRepository.getPlanById(planId);
    if (!existingPlan) {
      throw new NotFoundException('Commission plan not found');
    }

    if (dto.value !== undefined) {
      this.assertValueAllowedForType(existingPlan.type, dto.value);
    }
    this.assertDefaultPlanStaysActiveAndDefault(existingPlan, dto);

    const plan = await this.commissionAdminRepository.updatePlan(
      {
        id: existingPlan.id,
        type: existingPlan.type,
        provider: existingPlan.provider,
      },
      dto,
    );
    return this.getMappedCommissionPlanDto(plan);
  }

  async getAssignments(
    query: CommissionAssignmentQueryDto,
  ): Promise<PaginatedCommissionAssignmentsDto> {
    const { items, totalItemCount } =
      await this.commissionAdminRepository.getAssignmentRows({
        provider: query.provider,
        skip: (query.pageNumber - 1) * query.pageSize,
        take: query.pageSize,
      });

    return {
      items: items.map((row) => this.getMappedCommissionAssignmentRowDto(row)),
      totalItemCount,
    };
  }

  // Reconciliation report: every figure is recomputed from the stored charge snapshot, never from
  // the current plan, so editing or reassigning a plan later cannot flag old charges.
  async getCommissionReport(
    query: CommissionReportQueryDto,
  ): Promise<CommissionReportResponseDto> {
    const filters = {
      provider: query.provider,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? this.getInclusiveEndDate(query.to) : undefined,
    };
    const [payments, dbTotals] = await Promise.all([
      this.commissionAdminRepository.getPaidPaymentsForReport(filters),
      this.commissionAdminRepository.getPaidTotalsForReport(filters),
    ]);

    const rowByPhotographerId = new Map<
      string,
      CommissionReportPhotographerRowDto
    >();
    const paidPaymentCountByOrderId = new Map<string, number>();

    for (const payment of payments) {
      paidPaymentCountByOrderId.set(
        payment.orderId,
        (paidPaymentCountByOrderId.get(payment.orderId) ?? 0) + 1,
      );

      const photographer = payment.order.event.photographerProfile;
      let row = rowByPhotographerId.get(photographer.id);
      if (!row) {
        row = {
          photographerId: photographer.id,
          name: photographer.name,
          orderCount: 0,
          grossPaid: 0,
          commission: 0,
          delta: 0,
          isReconciled: true,
          charges: [],
        };
        rowByPhotographerId.set(photographer.id, row);
      }

      const charge = this.getReportChargeRow(payment);
      row.orderCount += 1;
      row.grossPaid = roundToCents(row.grossPaid + charge.paidAmount);
      row.commission = roundToCents(row.commission + charge.commissionAmount);
      row.delta = roundToCents(row.delta + charge.delta);
      row.isReconciled = row.isReconciled && charge.isReconciled;
      row.charges.push(charge);
    }

    const rows = [...rowByPhotographerId.values()].sort(
      (a, b) => b.commission - a.commission,
    );
    const grossFromRows = roundToCents(
      rows.reduce((total, row) => total + row.grossPaid, 0),
    );
    const commissionFromRows = roundToCents(
      rows.reduce((total, row) => total + row.commission, 0),
    );
    const periodDelta = roundToCents(
      Math.abs(grossFromRows - dbTotals.grossPaid) +
        Math.abs(commissionFromRows - dbTotals.commission),
    );

    return {
      rows,
      totalGrossPaid: grossFromRows,
      totalCommission: commissionFromRows,
      periodCheck: {
        grossFromRows,
        grossFromDb: dbTotals.grossPaid,
        commissionFromRows,
        commissionFromDb: dbTotals.commission,
        delta: periodDelta,
        isReconciled: periodDelta === 0,
      },
      duplicatePaidOrderIds: [...paidPaymentCountByOrderId.entries()]
        .filter(([, paidCount]) => paidCount > 1)
        .map(([orderId]) => orderId),
    };
  }

  // Assigns a plan to the option and, for ToyyibPay, turns split payment on (when a system
  // account is given) or off (when it is omitted) in the same write.
  async assignPlan(
    paymentPlatformOptionId: string,
    dto: AssignCommissionPlanDto,
  ): Promise<CommissionAssignmentRowDto> {
    const option = await this.commissionAdminRepository.getOptionForAssignment(
      paymentPlatformOptionId,
    );
    if (!option) {
      throw new NotFoundException('Payment platform option not found');
    }

    const plan = await this.commissionAdminRepository.getPlanForAssignment(
      dto.commissionPlanId,
    );
    if (!plan) {
      throw new NotFoundException('Commission plan not found');
    }
    if (!plan.isActive) {
      throw new BadRequestException('Commission plan is not active');
    }
    const isPlanForOtherProvider =
      plan.provider !== null && plan.provider !== option.provider;
    if (isPlanForOtherProvider) {
      throw new BadRequestException(
        `Commission plan is for ${plan.provider} and cannot be assigned to a ${option.provider} option`,
      );
    }

    const split = await this.getValidatedSplit(
      option,
      dto.splitSystemAccountId,
    );

    await this.commissionAdminRepository.assignPlan({
      paymentPlatformOptionId,
      commissionPlanId: plan.id,
      split,
    });

    const row = await this.commissionAdminRepository.getAssignmentRowByOptionId(
      paymentPlatformOptionId,
    );
    if (!row) {
      throw new InternalServerErrorException(
        'Payment platform option disappeared while assigning a commission plan',
      );
    }
    return this.getMappedCommissionAssignmentRowDto(row);
  }

  // A plan can only be deleted while nothing depends on it: no option is assigned to it, no
  // charge has ever used it (that would silently detach financial history), and it is not the
  // default (the default is what every unassigned option falls back to — deactivate instead).
  async deletePlan(planId: string): Promise<{ success: boolean }> {
    const plan = await this.commissionAdminRepository.getPlanById(planId);
    if (!plan) {
      throw new NotFoundException('Commission plan not found');
    }
    if (plan.isDefault) {
      throw new ConflictException(
        'Set another plan as the default before deleting this one',
      );
    }
    if (plan._count.assignments > 0) {
      throw new ConflictException(
        'Remove the commission assignments using this plan before deleting it',
      );
    }
    if (
      (await this.commissionAdminRepository.countChargesForPlan(planId)) > 0
    ) {
      throw new ConflictException(
        'This plan has been used for charges and cannot be deleted — deactivate it instead',
      );
    }

    await this.commissionAdminRepository.deletePlan(plan);
    return { success: true };
  }

  async removeAssignment(
    paymentPlatformOptionId: string,
  ): Promise<{ success: boolean }> {
    const assignment =
      await this.commissionAdminRepository.getAssignmentByOptionId(
        paymentPlatformOptionId,
      );
    if (!assignment) {
      throw new NotFoundException(
        'This payment platform option has no commission assignment',
      );
    }

    // Deleting the assignment would cascade-delete the split link and silently stop the split.
    const hasSplit = assignment.toyyibPayMerchantOption !== null;
    if (hasSplit) {
      throw new ConflictException(
        'Turn split payment off before removing the commission assignment',
      );
    }

    await this.commissionAdminRepository.deleteAssignment(
      paymentPlatformOptionId,
    );
    return { success: true };
  }

  // A bare date means the whole day, so `to=2026-10-31` includes orders paid on the 31st.
  private getInclusiveEndDate(to: string): Date {
    const isBareDate = to.length === BARE_DATE_LENGTH;
    return new Date(isBareDate ? `${to}${END_OF_DAY_SUFFIX}` : to);
  }

  private getReportChargeRow(
    payment: CommissionReportPaymentPayload,
  ): CommissionReportChargeRowDto {
    const charge = payment.commissionCharge;
    const paidAmount = Number(payment.amount);
    const base = {
      paymentId: payment.id,
      orderId: payment.orderId,
      eventTitle: payment.order.event.title,
      paidAt: payment.createdAt,
      paidAmount,
    };

    // A PAID payment without a charge is legitimate (commission not imposed / no plan): it counts
    // toward gross and owes nothing.
    if (!charge) {
      return {
        ...base,
        planName: null,
        commissionType: null,
        baseAmount: 0,
        commissionAmount: 0,
        recomputedAmount: 0,
        delta: 0,
        isReconciled: true,
      };
    }

    const commissionAmount = Number(charge.commissionAmount);
    const recomputedAmount = this.getRecomputedCommissionAmount(
      charge,
      payment,
    );
    const delta = roundToCents(commissionAmount - recomputedAmount);
    const isPaymentAmountMatching =
      Number(charge.originalPaymentAmount) === paidAmount;

    return {
      ...base,
      planName: charge.commissionPlan?.name ?? '(deleted plan)',
      commissionType: charge.commissionType,
      baseAmount: Number(charge.commissionBaseAmount),
      commissionAmount,
      recomputedAmount,
      delta,
      isReconciled: delta === 0 && isPaymentAmountMatching,
    };
  }

  private getRecomputedCommissionAmount(
    charge: NonNullable<CommissionReportPaymentPayload['commissionCharge']>,
    payment: CommissionReportPaymentPayload,
  ): number {
    const appliedRate = this.getAppliedRate(charge);
    // No snapshot detail row means the charge itself is broken: report it as a full delta.
    if (appliedRate === null) {
      return 0;
    }

    return this.commissionCalculatorRegistry
      .getCalculator(charge.commissionType)
      .calculate(appliedRate, {
        amountPaid: Number(payment.amount),
        itemPrices: payment.order.items.map((item) => Number(item.price)),
      }).commissionAmount;
  }

  private getAppliedRate(
    charge: NonNullable<CommissionReportPaymentPayload['commissionCharge']>,
  ): number | null {
    switch (charge.commissionType) {
      case CommissionType.PERCENTAGE_PER_TRANSACTION:
        return charge.percentagePerTransaction
          ? Number(charge.percentagePerTransaction.percentageRateApplied)
          : null;
      case CommissionType.AMOUNT_PER_TRANSACTION:
        return charge.amountPerTransaction
          ? Number(charge.amountPerTransaction.flatAmountApplied)
          : null;
      case CommissionType.PERCENTAGE_PER_UNIT:
        return charge.percentagePerUnit
          ? Number(charge.percentagePerUnit.percentageRateApplied)
          : null;
      case CommissionType.AMOUNT_PER_UNIT:
        return charge.amountPerUnit
          ? Number(charge.amountPerUnit.commissionPerUnitApplied)
          : null;
    }
  }

  private async getValidatedSplit(
    option: {
      provider: PaymentProvider;
      toyyibPayPaymentPlatformOption: { id: string } | null;
    },
    splitSystemAccountId: string | null | undefined,
  ): Promise<{
    toyyibPayPaymentPlatformOptionId: string;
    systemToyyibPayPlatformAccountId: string;
  } | null> {
    const isSplitRequested =
      splitSystemAccountId !== undefined && splitSystemAccountId !== null;
    if (!isSplitRequested) {
      return null;
    }

    const toyyibPayOption = option.toyyibPayPaymentPlatformOption;
    const isSplitSupported =
      option.provider === PaymentProvider.TOYYIBPAY && toyyibPayOption !== null;
    if (!isSplitSupported) {
      throw new BadRequestException(
        'Split payment is only available for ToyyibPay options',
      );
    }

    const isSystemAccountExisting =
      await this.commissionAdminRepository.isToyyibPaySystemAccountExisting(
        splitSystemAccountId,
      );
    if (!isSystemAccountExisting) {
      throw new NotFoundException('ToyyibPay system account not found');
    }

    return {
      toyyibPayPaymentPlatformOptionId: toyyibPayOption.id,
      systemToyyibPayPlatformAccountId: splitSystemAccountId,
    };
  }

  private assertValueAllowedForType(type: CommissionType, value: number): void {
    const isPercentageType =
      type === CommissionType.PERCENTAGE_PER_TRANSACTION ||
      type === CommissionType.PERCENTAGE_PER_UNIT;
    if (isPercentageType && value > MAX_PERCENTAGE) {
      throw new BadRequestException(
        `A percentage commission must be between 0.01 and ${MAX_PERCENTAGE}`,
      );
    }
  }

  // The default plan is what every option without its own assignment is charged by, so it must
  // always exist and be active: it can only be replaced by making another plan the default.
  private assertDefaultPlanStaysActiveAndDefault(
    existingPlan: CommissionAdminPlanPayload,
    dto: UpdateCommissionPlanDto,
  ): void {
    const isDefaultAfterUpdate = dto.isDefault ?? existingPlan.isDefault;
    const isActiveAfterUpdate = dto.isActive ?? existingPlan.isActive;

    if (existingPlan.isDefault && !isDefaultAfterUpdate) {
      throw new ConflictException(
        'Set another plan as the default instead of unsetting this one',
      );
    }
    if (existingPlan.isDefault && !isActiveAfterUpdate) {
      throw new ConflictException(
        'Set another plan as the default before deactivating this one',
      );
    }
    if (isDefaultAfterUpdate && !isActiveAfterUpdate) {
      throw new BadRequestException('An inactive plan cannot be the default');
    }
  }

  private getMappedCommissionPlanDto(
    plan: CommissionAdminPlanPayload,
  ): CommissionPlanDto {
    const value = this.commissionCalculatorRegistry
      .getCalculator(plan.type)
      .getPlanValue(plan);
    if (value === null) {
      throw new InternalServerErrorException(
        `Commission plan ${plan.id} has no value for its type ${plan.type}`,
      );
    }

    return {
      id: plan.id,
      name: plan.name,
      type: plan.type,
      provider: plan.provider,
      isDefault: plan.isDefault,
      isActive: plan.isActive,
      value,
      assignmentCount: plan._count.assignments,
      createdAt: plan.createdAt,
    };
  }

  private getMappedCommissionAssignmentRowDto(
    row: CommissionAssignmentRowPayload,
  ): CommissionAssignmentRowDto {
    const assignment = row.commissionAssignment;
    const splitAccount =
      assignment?.toyyibPayMerchantOption?.systemToyyibPayPlatformAccount;

    return {
      paymentPlatformOptionId: row.id,
      provider: row.provider,
      approvalStatus: row.approvalStatus,
      photographerName: row.userPlatform.photographerProfile?.name ?? null,
      photographerEmail: row.userPlatform.user.email,
      commissionPlanId: assignment?.commissionPlan.id ?? null,
      commissionPlanName: assignment?.commissionPlan.name ?? null,
      splitSystemAccountId: splitAccount?.id ?? null,
      splitUsername: splitAccount?.splitRecipientId ?? null,
    };
  }
}
