import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { OrderService } from './order.service';

jest.mock('../event/event.service', () => ({ EventService: class {} }));
jest.mock('../photographer/photographer.service', () => ({
  PhotographerService: class {},
}));

describe('OrderService.create', () => {
  let orderRepository: {
    createOrder: jest.Mock;
    countUploadedPhotosForEvent: jest.Mock;
  };
  let eventService: { getPublishedEventDetail: jest.Mock };
  let orderPricingService: { getValidatedPricing: jest.Mock };
  let orderHistoryService: { getMappedOrderPaymentDto: jest.Mock };
  let payableOptionService: {
    getPayableOption: jest.Mock;
    getPendingPaymentCreateInput: jest.Mock;
  };
  let toyyibPayPrePaymentService: {
    createBillForPayment: jest.Mock;
    getExistingBillPaymentUrl: jest.Mock;
  };
  let service: OrderService;

  const event = {
    id: 'event-1',
    photographerId: 'photographer-1',
    title: 'BUKIT TINGGI',
  };
  const dto: any = {
    eventId: 'event-1',
    email: 'rider@example.com',
    countryCode: 'MALAYSIA',
    phone: '123',
    items: [{ photoId: 'p1' }],
    idempotencyKey: 'key-1',
  };
  const pricing = { items: [], subtotal: 12, discountAmount: 0, total: 12 };
  const option = { id: 'option-1', provider: 'CASH' };
  const payment = {
    id: 'pay-1',
    provider: 'CASH',
    status: 'PENDING',
    amount: '12',
  };
  const createdOrder = {
    id: 'order-1',
    eventId: 'event-1',
    email: 'rider@example.com',
    countryCode: 'MALAYSIA',
    phone: '123',
    subtotal: 12,
    discountAmount: 0,
    total: 12,
    priceBreakdown: {},
    voucherId: null,
    voucherName: null,
    status: 'PENDING_CONFIRMATION',
    createdAt: new Date(),
    items: [],
    payments: [payment],
  };

  beforeEach(() => {
    orderRepository = {
      createOrder: jest
        .fn()
        .mockResolvedValue({ order: createdOrder, isNew: true }),
      countUploadedPhotosForEvent: jest.fn().mockResolvedValue(1),
    };
    eventService = {
      getPublishedEventDetail: jest.fn().mockResolvedValue(event),
    };
    orderPricingService = {
      getValidatedPricing: jest.fn().mockReturnValue(pricing),
    };
    orderHistoryService = {
      getMappedOrderPaymentDto: jest.fn().mockReturnValue({
        id: 'pay-1',
        provider: 'CASH',
        status: 'PENDING',
        amount: 12,
      }),
    };
    payableOptionService = {
      getPayableOption: jest.fn().mockResolvedValue(option),
      getPendingPaymentCreateInput: jest
        .fn()
        .mockReturnValue({ status: 'PENDING' }),
    };
    toyyibPayPrePaymentService = {
      createBillForPayment: jest.fn(),
      getExistingBillPaymentUrl: jest.fn(),
    };
    service = new OrderService(
      orderRepository as any,
      eventService as any,
      {} as any,
      { buildPublicUrl: jest.fn() } as any,
      orderPricingService as any,
      orderHistoryService as any,
      payableOptionService as any,
      toyyibPayPrePaymentService as any,
    );
  });

  it('creates the order with the server-computed pricing and one pending payment', async () => {
    const result = await service.createOrder(dto);

    expect(
      payableOptionService.getPendingPaymentCreateInput,
    ).toHaveBeenCalledWith(option, 12);
    expect(orderRepository.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ pricing, payment: { status: 'PENDING' } }),
    );
    expect(result.payment).toEqual({
      id: 'pay-1',
      provider: 'CASH',
      status: 'PENDING',
      amount: 12,
    });
  });

  it('creates a ToyyibPay bill and attaches its payment URL when the option is TOYYIBPAY', async () => {
    payableOptionService.getPayableOption.mockResolvedValue({
      id: 'option-2',
      provider: 'TOYYIBPAY',
    });
    orderHistoryService.getMappedOrderPaymentDto.mockReturnValue({
      id: 'pay-1',
      provider: 'TOYYIBPAY',
      status: 'PENDING',
      amount: 12,
    });
    toyyibPayPrePaymentService.createBillForPayment.mockResolvedValue(
      'https://dev.toyyibpay.com/abc123',
    );

    const result = await service.createOrder(dto);

    expect(
      toyyibPayPrePaymentService.createBillForPayment,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentId: 'pay-1',
        paymentPlatformOptionId: 'option-2',
        amount: 12,
        externalReferenceNo: 'pay-1',
        billName: 'BUKIT TINGGI',
        payerEmail: 'rider@example.com',
        payerPhone: '123',
      }),
    );
    expect(result.payment?.paymentUrl).toBe('https://dev.toyyibpay.com/abc123');
  });

  it('reuses the existing bill on a retried (duplicate idempotency key) TOYYIBPAY checkout, instead of creating a second one', async () => {
    payableOptionService.getPayableOption.mockResolvedValue({
      id: 'option-2',
      provider: 'TOYYIBPAY',
    });
    orderHistoryService.getMappedOrderPaymentDto.mockReturnValue({
      id: 'pay-1',
      provider: 'TOYYIBPAY',
      status: 'PENDING',
      amount: 12,
    });
    orderRepository.createOrder.mockResolvedValue({
      order: createdOrder,
      isNew: false,
    });
    toyyibPayPrePaymentService.getExistingBillPaymentUrl.mockResolvedValue(
      'https://dev.toyyibpay.com/original-bill',
    );

    const result = await service.createOrder(dto);

    expect(
      toyyibPayPrePaymentService.getExistingBillPaymentUrl,
    ).toHaveBeenCalledWith('pay-1');
    expect(
      toyyibPayPrePaymentService.createBillForPayment,
    ).not.toHaveBeenCalled();
    expect(result.payment?.paymentUrl).toBe(
      'https://dev.toyyibpay.com/original-bill',
    );
  });

  it('falls back to creating a bill on a duplicate key if no bill was written for the first attempt yet', async () => {
    payableOptionService.getPayableOption.mockResolvedValue({
      id: 'option-2',
      provider: 'TOYYIBPAY',
    });
    orderHistoryService.getMappedOrderPaymentDto.mockReturnValue({
      id: 'pay-1',
      provider: 'TOYYIBPAY',
      status: 'PENDING',
      amount: 12,
    });
    orderRepository.createOrder.mockResolvedValue({
      order: createdOrder,
      isNew: false,
    });
    toyyibPayPrePaymentService.getExistingBillPaymentUrl.mockResolvedValue(
      null,
    );
    toyyibPayPrePaymentService.createBillForPayment.mockResolvedValue(
      'https://dev.toyyibpay.com/recovered-bill',
    );

    const result = await service.createOrder(dto);

    expect(toyyibPayPrePaymentService.createBillForPayment).toHaveBeenCalled();
    expect(result.payment?.paymentUrl).toBe(
      'https://dev.toyyibpay.com/recovered-bill',
    );
  });

  it('does not attempt to create a ToyyibPay bill for a cash payment', async () => {
    await service.createOrder(dto);

    expect(
      toyyibPayPrePaymentService.createBillForPayment,
    ).not.toHaveBeenCalled();
  });

  it('writes nothing when the photographer has no usable payment option', async () => {
    payableOptionService.getPayableOption.mockRejectedValue(
      new BadRequestException('no approved payment method'),
    );

    await expect(service.createOrder(dto)).rejects.toThrow(BadRequestException);
    expect(orderRepository.createOrder).not.toHaveBeenCalled();
  });

  it('writes nothing when the prices do not validate', async () => {
    orderPricingService.getValidatedPricing.mockImplementation(() => {
      throw new BadRequestException('Prices have changed');
    });

    await expect(service.createOrder(dto)).rejects.toThrow(
      'Prices have changed',
    );
    expect(orderRepository.createOrder).not.toHaveBeenCalled();
  });

  it('rejects photos that do not belong to the event', async () => {
    orderRepository.countUploadedPhotosForEvent.mockResolvedValue(0);

    await expect(service.createOrder(dto)).rejects.toThrow(
      'do not belong to this event',
    );
    expect(orderRepository.createOrder).not.toHaveBeenCalled();
  });
});

describe('OrderService.getHistory', () => {
  const createdAt = new Date('2026-09-20T09:00:00Z');
  let orderRepository: { getOrderOwnershipById: jest.Mock };
  let orderHistoryService: {
    getOrderHistoryEntries: jest.Mock;
    getOrderCommission: jest.Mock;
    getOrderPaymentBillCode: jest.Mock;
  };
  let service: OrderService;

  beforeEach(() => {
    orderRepository = {
      getOrderOwnershipById: jest.fn().mockResolvedValue({
        id: 'order-1',
        createdAt,
        event: { photographerId: 'photographer-1' },
      }),
    };
    orderHistoryService = {
      getOrderHistoryEntries: jest.fn().mockResolvedValue([{ id: 'log-1' }]),
      getOrderCommission: jest.fn().mockResolvedValue({ commissionAmount: 3 }),
      getOrderPaymentBillCode: jest.fn().mockResolvedValue('abc12345'),
    };
    const photographerService = {
      getOwnPhotographerProfileId: jest
        .fn()
        .mockResolvedValue('photographer-1'),
    };
    service = new OrderService(
      orderRepository as any,
      {} as any,
      photographerService as any,
      {} as any,
      {} as any,
      orderHistoryService as any,
      {} as any,
      {} as any,
    );
  });

  it('returns the entries and the order creation time for the owning photographer', async () => {
    const history = await service.getHistory({} as any, 'order-1');

    expect(history).toEqual({
      orderId: 'order-1',
      orderCreatedAt: createdAt,
      entries: [{ id: 'log-1' }],
      commission: { commissionAmount: 3 },
      billCode: 'abc12345',
    });
  });

  it('returns 404 for an order that does not exist', async () => {
    orderRepository.getOrderOwnershipById.mockResolvedValue(null);

    await expect(service.getHistory({} as any, 'nope')).rejects.toThrow(
      NotFoundException,
    );
    expect(orderHistoryService.getOrderHistoryEntries).not.toHaveBeenCalled();
  });

  it("returns 403, not 404, for another photographer's order", async () => {
    orderRepository.getOrderOwnershipById.mockResolvedValue({
      id: 'order-1',
      createdAt,
      event: { photographerId: 'someone-else' },
    });

    await expect(service.getHistory({} as any, 'order-1')).rejects.toThrow(
      ForbiddenException,
    );
    expect(orderHistoryService.getOrderHistoryEntries).not.toHaveBeenCalled();
  });
});

describe('OrderService.listForPhotographer', () => {
  it('forwards the payment tracking filter to the repository', async () => {
    const orderRepository = {
      listOrdersByPhotographer: jest
        .fn()
        .mockResolvedValue({ items: [], totalItemCount: 0, totalRevenue: 0 }),
    };
    const photographerService = {
      getOwnPhotographerProfileId: jest
        .fn()
        .mockResolvedValue('photographer-1'),
    };
    const service = new OrderService(
      orderRepository as any,
      {} as any,
      photographerService as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await service.listForPhotographer(
      {} as any,
      {
        pageNumber: 2,
        pageSize: 10,
        paymentTracking: 'LEGACY',
      } as any,
    );

    expect(orderRepository.listOrdersByPhotographer).toHaveBeenCalledWith(
      'photographer-1',
      {
        skip: 10,
        take: 10,
        eventId: undefined,
        status: undefined,
        paymentTracking: 'LEGACY',
      },
    );
  });
});
