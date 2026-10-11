const sendMailMock = jest.fn();

jest.mock('zeptomail', () => ({
  SendMailClient: jest.fn().mockImplementation(() => ({
    sendMail: sendMailMock,
  })),
}));

import { EmailService } from './email.service';

describe('EmailService.sendPhotosDeliveredEmail', () => {
  let service: EmailService;

  beforeEach(() => {
    sendMailMock.mockReset();
    process.env.CLIENT_URL = 'http://localhost:4200';
    process.env.RECEIPT_URL = '/order-receipt';
    process.env.IMAGE_URL = '/order-images';
    service = new EmailService();
  });

  it('sends the delivery email with receipt and image links built from orderId', async () => {
    sendMailMock.mockResolvedValue({ ok: true });

    await service.sendPhotosDeliveredEmail({
      orderId: 'order-1',
      email: 'rider@example.com',
      amount: 30,
    });

    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const payload = sendMailMock.mock.calls[0][0];
    expect(payload.to).toEqual([
      {
        email_address: {
          address: 'rider@example.com',
          name: 'rider@example.com',
        },
      },
    ]);
    expect(payload.htmlbody).toContain(
      'http://localhost:4200/order-receipt?orderId=order-1',
    );
    expect(payload.htmlbody).toContain(
      'http://localhost:4200/order-images?orderId=order-1',
    );
    expect(payload.htmlbody).toContain('30.00');
  });

  it('does not throw when ZeptoMail rejects the send', async () => {
    sendMailMock.mockRejectedValue(new Error('ZeptoMail is down'));

    await expect(
      service.sendPhotosDeliveredEmail({
        orderId: 'order-1',
        email: 'rider@example.com',
        amount: 30,
      }),
    ).resolves.toBeUndefined();
  });
});

describe('EmailService.sendPaymentFailedEmail', () => {
  let service: EmailService;

  beforeEach(() => {
    sendMailMock.mockReset();
    process.env.CLIENT_URL = 'http://localhost:4200';
    service = new EmailService();
  });

  it('sends a payment-failed email with a retry link back to the cart', async () => {
    sendMailMock.mockResolvedValue({ ok: true });

    await service.sendPaymentFailedEmail({
      orderId: 'order-1',
      email: 'rider@example.com',
      amount: 30,
    });

    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const payload = sendMailMock.mock.calls[0][0];
    expect(payload.subject).toBe('Your payment could not be completed');
    expect(payload.to).toEqual([
      {
        email_address: {
          address: 'rider@example.com',
          name: 'rider@example.com',
        },
      },
    ]);
    expect(payload.htmlbody).toContain('http://localhost:4200/cart');
    expect(payload.htmlbody).toContain('30.00');
  });

  it('does not throw when ZeptoMail rejects the send', async () => {
    sendMailMock.mockRejectedValue(new Error('ZeptoMail is down'));

    await expect(
      service.sendPaymentFailedEmail({
        orderId: 'order-1',
        email: 'rider@example.com',
        amount: 30,
      }),
    ).resolves.toBeUndefined();
  });
});
