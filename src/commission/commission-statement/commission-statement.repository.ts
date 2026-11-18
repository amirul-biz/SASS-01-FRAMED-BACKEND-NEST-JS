import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import type {
  CommissionStatementStatus,
  UserRole,
} from '../../../generated/prisma/enums';
import { PrismaService } from '../../config/database/prisma.service';
import { periodRange } from './commission-statement.period';

const WITH_ATTACHMENTS = {
  attachments: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.CommissionStatementInclude;

export type StatementWithAttachments = Prisma.CommissionStatementGetPayload<{
  include: typeof WITH_ATTACHMENTS;
}>;

export interface OwedRow {
  photographerId: string;
  period: Date;
  amount: number;
}

@Injectable()
export class CommissionStatementRepository {
  constructor(private readonly prisma: PrismaService) {}

  // What a photographer still owes: confirmed-paid commission charges, minus ToyyibPay payments
  // whose option has a split recipient (that commission is already deducted at checkout). Grouped
  // by Malaysia-time month. The split check reads the CURRENT assignment, not a per-charge snapshot.
  async getOwed(filter: {
    photographerId?: string;
    period?: Date;
  }): Promise<OwedRow[]> {
    const photographerFilter = filter.photographerId
      ? Prisma.sql`AND e.photographer_id = ${filter.photographerId}`
      : Prisma.empty;
    let periodFilter = Prisma.empty;
    if (filter.period) {
      const { gte, lt } = periodRange(filter.period);
      periodFilter = Prisma.sql`AND cc.commission_imposed_at >= ${gte} AND cc.commission_imposed_at < ${lt}`;
    }

    const rows = await this.prisma.$queryRaw<
      { photographer_id: string; period: Date; amount: Prisma.Decimal }[]
    >`
      SELECT e.photographer_id,
             date_trunc('month', cc.commission_imposed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kuala_Lumpur')::date AS period,
             SUM(cc.commission_amount) AS amount
      FROM commission_charges cc
      JOIN merchant_payments mp ON mp.id = cc.payment_id
      JOIN orders o ON o.id = mp.order_id
      JOIN events e ON e.id = o.event_id
      WHERE mp.status = 'PAID'
        AND NOT (
          mp.provider = 'TOYYIBPAY'
          AND EXISTS (
            SELECT 1
            FROM merchant_toyyibpay_payment_platform_options t
            JOIN commission_toyyibpay_merchant_options c
              ON c.toyyibpay_payment_platform_option_id = t.id
            WHERE t.payment_platform_option_id = mp.merchant_payment_platform_option_id
          )
        )
        ${photographerFilter}
        ${periodFilter}
      GROUP BY 1, 2`;

    return rows.map((row) => ({
      photographerId: row.photographer_id,
      period: row.period,
      amount: Number(row.amount),
    }));
  }

  async getStatements(filter: {
    photographerId?: string;
    period?: Date;
  }): Promise<StatementWithAttachments[]> {
    return await this.prisma.commissionStatement.findMany({
      where: filter,
      include: WITH_ATTACHMENTS,
    });
  }

  async upsertStatement(
    photographerId: string,
    period: Date,
    update: {
      status?: CommissionStatementStatus;
      amountPaid?: number | null;
      paidAt?: Date | null;
      markedByUserId?: string;
      notes?: string;
    } = {},
  ): Promise<StatementWithAttachments> {
    return await this.prisma.commissionStatement.upsert({
      where: { photographerId_period: { photographerId, period } },
      create: { photographerId, period, ...update },
      update,
      include: WITH_ATTACHMENTS,
    });
  }

  async addAttachment(
    statementId: string,
    data: {
      key: string;
      fileName: string;
      mimeType: string;
      uploadedByRole: UserRole;
    },
  ): Promise<void> {
    await this.prisma.commissionStatementAttachment.create({
      data: { statementId, ...data },
    });
  }

  async getPhotographers(
    ids: string[],
  ): Promise<{ id: string; name: string; email: string }[]> {
    const profiles = await this.prisma.photographerProfile.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        name: true,
        userPlatform: { select: { user: { select: { email: true } } } },
      },
    });
    return profiles.map((p) => ({
      id: p.id,
      name: p.name,
      email: p.userPlatform.user.email,
    }));
  }

  async photographerExists(id: string): Promise<boolean> {
    return (await this.prisma.photographerProfile.count({ where: { id } })) > 0;
  }
}
