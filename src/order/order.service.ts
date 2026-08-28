import { BadRequestException, Injectable } from '@nestjs/common';
import { EventService } from '../event/event.service';
import { PhotographerService } from '../photographer/photographer.service';
import type { AuthenticatedUser } from '../types/express';
import {
  CreateOrderDto,
  OrderListQueryDto,
  OrderResponseDto,
  PaginatedOrderListResponseDto,
  PhotographerOrderDto,
  PriceBreakdownDto,
} from './order.dto';
import { OrderRepository } from './order.repository';

type OrderWithItems = Awaited<ReturnType<OrderRepository['create']>>;
type OrderWithItemsAndEvent = Awaited<
  ReturnType<OrderRepository['getManyByPhotographer']>
>['items'][number];

@Injectable()
export class OrderService {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly eventService: EventService,
    private readonly photographerService: PhotographerService,
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
    return this.toOrderDto(order);
  }

  async listForPhotographer(
    user: AuthenticatedUser,
    query: OrderListQueryDto,
  ): Promise<PaginatedOrderListResponseDto> {
    const photographerId = await this.photographerService.getOwnPhotographerProfileId(user);
    const skip = (query.pageNumber - 1) * query.pageSize;

    const { items, totalItemCount, totalRevenue } = await this.orderRepository.getManyByPhotographer(
      photographerId,
      { skip, take: query.pageSize, eventId: query.eventId, status: query.status },
    );

    return {
      items: items.map((order) => this.toPhotographerOrderDto(order)),
      totalItemCount,
      totalPageCount: Math.ceil(totalItemCount / query.pageSize),
      pageNumber: query.pageNumber,
      pageSize: query.pageSize,
      summary: { totalOrders: totalItemCount, totalRevenue },
    };
  }

  private toOrderDto(order: OrderWithItems): OrderResponseDto {
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
        photoName: item.photo.originalName,
        formatLabel: item.formatLabel,
        price: Number(item.price),
      })),
    };
  }

  private toPhotographerOrderDto(order: OrderWithItemsAndEvent): PhotographerOrderDto {
    return { ...this.toOrderDto(order), eventTitle: order.event.title };
  }
}
