import { ToyyibPayOrderDeliverySweepService } from './toyyibpay-order-delivery-sweep.service';

describe('ToyyibPayOrderDeliverySweepService.redeliverStuckOrders', () => {
  let merchantOrderPaymentRepository: {
    getUndeliveredPaidOrders: jest.Mock;
    deliverOrder: jest.Mock;
  };
  let service: ToyyibPayOrderDeliverySweepService;

  beforeEach(() => {
    merchantOrderPaymentRepository = {
      getUndeliveredPaidOrders: jest.fn().mockResolvedValue([]),
      deliverOrder: jest.fn().mockResolvedValue(true),
    };
    service = new ToyyibPayOrderDeliverySweepService(
      merchantOrderPaymentRepository as any,
    );
  });

  it('reports zero checked and delivered when nothing is stuck', async () => {
    await expect(service.redeliverStuckOrders()).resolves.toEqual({
      checked: 0,
      delivered: 0,
    });
    expect(merchantOrderPaymentRepository.deliverOrder).not.toHaveBeenCalled();
  });

  it('redelivers every stuck order and reports how many actually delivered', async () => {
    merchantOrderPaymentRepository.getUndeliveredPaidOrders.mockResolvedValue([
      { orderId: 'order-1', email: 'a@example.com' },
      { orderId: 'order-2', email: 'b@example.com' },
    ]);
    merchantOrderPaymentRepository.deliverOrder
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    await expect(service.redeliverStuckOrders()).resolves.toEqual({
      checked: 2,
      delivered: 1,
    });
    expect(merchantOrderPaymentRepository.deliverOrder).toHaveBeenCalledWith(
      'order-1',
      'a@example.com',
    );
    expect(merchantOrderPaymentRepository.deliverOrder).toHaveBeenCalledWith(
      'order-2',
      'b@example.com',
    );
  });

  it('does not let one order throwing stop the rest of the sweep', async () => {
    merchantOrderPaymentRepository.getUndeliveredPaidOrders.mockResolvedValue([
      { orderId: 'order-1', email: 'a@example.com' },
      { orderId: 'order-2', email: 'b@example.com' },
    ]);
    merchantOrderPaymentRepository.deliverOrder
      .mockRejectedValueOnce(new Error('db exploded'))
      .mockResolvedValueOnce(true);

    await expect(service.redeliverStuckOrders()).resolves.toEqual({
      checked: 2,
      delivered: 1,
    });
  });
});
