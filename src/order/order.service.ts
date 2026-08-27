import { BadRequestException, Injectable } from '@nestjs/common';
import { EventService } from '../event/event.service';
import { CreateOrderDto, OrderResponseDto, PriceBreakdownDto } from './order.dto';
import { OrderRepository } from './order.repository';

@Injectable()
export class OrderService {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly eventService: EventService,
  ) {}

  async create(dto: CreateOrderDto): Promise<OrderResponseDto> {
    // Throws NotFoundException for a missing/unpublished event — a bad eventId never creates a
    // dangling order.
    await this.eventService.getPublishedEventDetail(dto.eventId);

    const photoIds = dto.items.map((item) => item.photoId);
    const ownedCount = await this.orderRepository.countUploadedPhotosForEvent(dto.eventId, photoIds);
    if (ownedCount !== photoIds.length) {
      throw new BadRequestException('One or more photos do not belong to this event');
    }

    if (dto.voucherId && !(await this.orderRepository.voucherExists(dto.voucherId))) {
      throw new BadRequestException('Unknown voucher');
    }

    const order = await this.orderRepository.create(dto);

    return {
      id: order.id,
      eventId: order.eventId,
      email: order.email,
      countryCode: order.countryCode,
      phone: order.phone,
      subtotal: Number(order.subtotal),
      discountAmount: Number(order.discountAmount),
      total: Number(order.total),
      priceBreakdown: order.priceBreakdown as unknown as PriceBreakdownDto,
      voucherId: order.voucherId,
      voucherName: order.voucherName,
      status: order.status,
      createdAt: order.createdAt,
      items: order.items.map((item) => ({
        id: item.id,
        photoId: item.photoId,
        formatLabel: item.formatLabel,
        price: Number(item.price),
      })),
    };
  }
}
