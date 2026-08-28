import { Injectable } from '@nestjs/common';
import { PrismaService } from '../config/database/prisma.service';
import { VoucherDiscountType, Prisma } from '../../generated/prisma/client';

@Injectable()
export class VouchersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllForPhotographer(photographerId: string) {
    const vouchers = await this.prisma.voucher.findMany({
      where: { photographerId },
      orderBy: { createdAt: 'asc' },
    });
    return Promise.all(vouchers.map((voucher) => this.withBundlesUsingCount(voucher)));
  }

  async findById(id: string) {
    const voucher = await this.prisma.voucher.findUnique({ where: { id } });
    if (!voucher) return null;
    return this.withBundlesUsingCount(voucher);
  }

  create(data: {
    photographerId: string;
    name: string;
    discountType: VoucherDiscountType;
    conditions: Prisma.InputJsonValue;
  }) {
    return this.prisma.voucher.create({ data });
  }

  update(
    id: string,
    data: Partial<{
      name: string;
      discountType: VoucherDiscountType;
      conditions: Prisma.InputJsonValue;
    }>,
  ) {
    return this.prisma.voucher.update({ where: { id }, data });
  }

  delete(id: string) {
    return this.prisma.voucher.delete({ where: { id } });
  }

  countBundlesUsing(voucherId: string): Promise<number> {
    return this.prisma.bundleVoucher.count({ where: { voucherId } });
  }

  private async withBundlesUsingCount<T extends { id: string }>(voucher: T) {
    const bundlesUsingCount = await this.countBundlesUsing(voucher.id);
    return { ...voucher, bundlesUsingCount };
  }
}
