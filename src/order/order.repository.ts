import { Injectable } from '@nestjs/common';
import { PrismaService } from '../config/database/prisma.service';
import type { CreateOrderDto } from './order.dto';

@Injectable()
export class OrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async countUploadedPhotosForEvent(eventId: string, photoIds: string[]): Promise<number> {
    return await this.prisma.photo.count({
      where: {
        id: { in: photoIds },
        eventId,
        status: 'UPLOADED',
        deletedAt: null,
      },
    });
  }

  async create(dto: CreateOrderDto) {
    return await this.prisma.order.create({
      data: {
        eventId: dto.eventId,
        email: dto.email,
        countryCode: dto.countryCode,
        phone: dto.phone,
        subtotal: dto.subtotal,
        discountAmount: dto.discountAmount,
        total: dto.total,
        voucherName: dto.voucherName,
        items: {
          create: dto.items.map((item) => ({
            photoId: item.photoId,
            formatLabel: item.formatLabel,
            price: item.price,
          })),
        },
      },
      include: { items: true },
    });
  }
}
