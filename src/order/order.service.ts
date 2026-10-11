import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrivateStorageService } from '../config/storage/private-storage.service';
import { EventService } from '../event/event.service';
import { OrderDeliveryRepository } from '../merchant-order-payment/core/order-delivery/order-delivery.repository';
import { OrderHistoryService } from '../merchant-order-payment/core/order-history/order-history.service';
import { PayableOptionService } from '../merchant-order-payment/core/payable-option/payable-option.service';
import { ToyyibPayPrePaymentService } from '../merchant-order-payment/toyyibpay-order-payment/pre-payment/toyyibpay-pre-payment.service';
import { PhotographerService } from '../photographer/photographer.service';
import { OrderStatus, PaymentProvider } from '../../generated/prisma/enums';
import type { AuthenticatedUser } from '../types/express';
import {
  CreateOrderDto,
  OrderHistoryDto,
  OrderListQueryDto,
  OrderPaymentDto,
  OrderResponseDto,
  PaginatedOrderListResponseDto,
  PhotographerOrderDto,
  PriceBreakdownDto,
} from './order.dto';
import {
  OrderPayload,
  OrderRepository,
  PhotographerOrderPayload,
} from './order.repository';
import { OrderPricingService } from './order-pricing.service';

@Injectable()
export class OrderService {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly eventService: EventService,
    private readonly photographerService: PhotographerService,
    private readonly privateStorageService: PrivateStorageService,
    private readonly orderPricingService: OrderPricingService,
    private readonly orderHistoryService: OrderHistoryService,
    private readonly payableOptionService: PayableOptionService,
    private readonly toyyibPayPrePaymentService: ToyyibPayPrePaymentService,
    private readonly orderDeliveryRepository: OrderDeliveryRepository,
  ) {}

  async createOrder(dto: CreateOrderDto): Promise<OrderResponseDto> {
    // Throws NotFoundException for a missing/unpublished event — a bad eventId never creates a
    // dangling order.
    const event = await this.eventService.getPublishedEventDetail(dto.eventId);

    const isPhotosValid = await this.isPhotosBelongToEvent(dto);
    if (!isPhotosValid) {
      throw new BadRequestException(
        'One or more photos do not belong to this event',
      );
    }

    const paymentOption = await this.payableOptionService.getPayableOption(
      event.photographerId,
    );
    const pricing = this.orderPricingService.getValidatedPricing(event, dto);

    const { order, isNew } = await this.orderRepository.createOrder({
      eventId: dto.eventId,
      email: dto.email,
      countryCode: dto.countryCode,
      phone: dto.phone,
      idempotencyKey: dto.idempotencyKey,
      pricing,
      payment: this.payableOptionService.getPendingPaymentCreateInput(
        paymentOption,
        pricing.total,
      ),
    });
    const responseDto = this.getMappedOrderDto(order);

    const isToyyibPayOption =
      paymentOption.provider === PaymentProvider.TOYYIBPAY;
    if (isToyyibPayOption && responseDto.payment) {
      const [payment] = order.payments;
      const paymentUrl = await this.resolveToyyibPayPaymentUrl({
        isNew,
        paymentId: payment.id,
        paymentPlatformOptionId: paymentOption.id,
        isImposeCommission: paymentOption.isImposeCommission,
        amount: pricing.total,
        itemPrices: pricing.items.map((item) => item.price),
        billName: event.title,
        billDescription: `Photos for ${event.title}`,
        payerEmail: dto.email,
        payerPhone: dto.phone,
      });
      responseDto.payment = { ...responseDto.payment, paymentUrl };
    }

    return responseDto;
  }

  // Public, unauthenticated — reached from the receipt/image links in the delivery email.
  // orderId acts as the bearer token (unguessable UUID v4), same precedent as the ToyyibPay
  // return-URL's billCode check; the paid-status gate on top of that is what the 400 enforces.
  async getReceiptForCustomer(orderId: string): Promise<OrderResponseDto> {
    const order = await this.orderRepository.getOrderById(orderId);
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const isPaid =
      order.status !== OrderStatus.PENDING_CONFIRMATION &&
      order.status !== OrderStatus.CANCELLED;
    if (!isPaid) {
      throw new BadRequestException('This order has not been paid yet');
    }

    return this.getMappedOrderDto(order, true);
  }

  private async resolveToyyibPayPaymentUrl(params: {
    isNew: boolean;
    paymentId: string;
    paymentPlatformOptionId: string;
    isImposeCommission: boolean;
    amount: number;
    itemPrices: number[];
    billName: string;
    billDescription: string;
    payerEmail: string;
    payerPhone: string;
  }): Promise<string> {
    const existingPaymentUrl = params.isNew
      ? null
      : await this.toyyibPayPrePaymentService.getExistingBillPaymentUrl(
          params.paymentId,
        );
    if (existingPaymentUrl) {
      return existingPaymentUrl;
    }
    return await this.toyyibPayPrePaymentService.createBillForPayment({
      paymentId: params.paymentId,
      paymentPlatformOptionId: params.paymentPlatformOptionId,
      amount: params.amount,
      itemPrices: params.itemPrices,
      isImposeCommission: params.isImposeCommission,
      externalReferenceNo: params.paymentId,
      billName: params.billName,
      billDescription: params.billDescription,
      payerName: params.payerEmail,
      payerEmail: params.payerEmail,
      payerPhone: params.payerPhone,
    });
  }

  async listForPhotographer(
    user: AuthenticatedUser,
    query: OrderListQueryDto,
  ): Promise<PaginatedOrderListResponseDto> {
    const photographerId =
      await this.photographerService.getOwnPhotographerProfileId(user);
    const skip = (query.pageNumber - 1) * query.pageSize;

    const { items, totalItemCount, totalRevenue } =
      await this.orderRepository.listOrdersByPhotographer(photographerId, {
        skip,
        take: query.pageSize,
        eventId: query.eventId,
        status: query.status,
        paymentTracking: query.paymentTracking,
        orderIdSearch: query.orderIdSearch,
        emailSearch: query.emailSearch,
      });

    return {
      items: items.map((order) => this.getMappedPhotographerOrderDto(order)),
      totalItemCount,
      totalPageCount: Math.ceil(totalItemCount / query.pageSize),
      pageNumber: query.pageNumber,
      pageSize: query.pageSize,
      summary: { totalOrders: totalItemCount, totalRevenue },
    };
  }

  async getHistory(
    user: AuthenticatedUser,
    orderId: string,
  ): Promise<OrderHistoryDto> {
    const order = await this.orderRepository.getOrderOwnershipById(orderId);
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const photographerId =
      await this.photographerService.getOwnPhotographerProfileId(user);
    const isOwnOrder = order.event.photographerId === photographerId;
    if (!isOwnOrder) {
      throw new ForbiddenException('You do not have access to this order');
    }

    const entries =
      await this.orderHistoryService.getOrderHistoryEntries(orderId);
    const commission =
      await this.orderHistoryService.getOrderCommission(orderId);
    const billCode =
      await this.orderHistoryService.getOrderPaymentBillCode(orderId);
    return {
      orderId,
      orderCreatedAt: order.createdAt,
      entries,
      commission,
      billCode,
    };
  }

  // Closes the gap the regular sync button has: for an already-DELIVERED order, syncPayment
  // no-ops immediately (nothing left to sync) and never reaches the email step. This bypasses
  // that guard directly via resendDeliveryEmail — the same method the customer-side return-URL
  // retry button already uses.
  async resendDeliveryEmail(
    user: AuthenticatedUser,
    orderId: string,
  ): Promise<void> {
    const ownership = await this.orderRepository.getOrderOwnershipById(orderId);
    if (!ownership) {
      throw new NotFoundException('Order not found');
    }

    const photographerId =
      await this.photographerService.getOwnPhotographerProfileId(user);
    const isOwnOrder = ownership.event.photographerId === photographerId;
    if (!isOwnOrder) {
      throw new ForbiddenException('You do not have access to this order');
    }

    const order = await this.orderRepository.getOrderById(orderId);
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const latestPayment = order.payments[0];
    const canResend =
      order.status === OrderStatus.DELIVERED &&
      latestPayment?.provider === PaymentProvider.TOYYIBPAY;
    if (!canResend) {
      throw new BadRequestException(
        'This order has nothing to resend — it must be a delivered ToyyibPay order',
      );
    }

    await this.orderDeliveryRepository.resendDeliveryEmail(
      orderId,
      order.email,
      Number(latestPayment.amount),
    );
  }

  private async isPhotosBelongToEvent(dto: CreateOrderDto): Promise<boolean> {
    const photoIds = dto.items.map((item) => item.photoId);
    const ownedCount = await this.orderRepository.countUploadedPhotosForEvent(
      dto.eventId,
      photoIds,
    );
    return ownedCount === photoIds.length;
  }

  // useDeliveryUrl is true only for the post-payment customer delivery path
  // (getReceiptForCustomer) — the checkout response and the photographer's Studio view both keep
  // using the regular R2_PRIVATE_BUCKET_URL via buildPublicUrl.
  private getMappedOrderDto(
    order: OrderPayload,
    useDeliveryUrl = false,
  ): OrderResponseDto {
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
      payment: this.getMappedLatestPaymentDto(order),
      items: order.items.map((item) => ({
        id: item.id,
        photoId: item.photoId,
        photoName: item.photo.originalName,
        photoUrl: useDeliveryUrl
          ? this.privateStorageService.buildDeliveryUrl(item.photo.key)
          : this.privateStorageService.buildPublicUrl(item.photo.key),
        formatLabel: item.formatLabel,
        price: Number(item.price),
      })),
    };
  }

  private getMappedPhotographerOrderDto(
    order: PhotographerOrderPayload,
  ): PhotographerOrderDto {
    return { ...this.getMappedOrderDto(order), eventTitle: order.event.title };
  }

  private getMappedLatestPaymentDto(
    order: OrderPayload,
  ): OrderPaymentDto | null {
    const [latestPayment] = order.payments;
    if (!latestPayment) {
      return null;
    }
    return this.orderHistoryService.getMappedOrderPaymentDto(latestPayment);
  }
}
