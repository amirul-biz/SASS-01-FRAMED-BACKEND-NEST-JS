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

  it('sends a payment-failed email with contact-us and contact-photographer WhatsApp links', async () => {
    sendMailMock.mockResolvedValue({ ok: true });

    await service.sendPaymentFailedEmail({
      orderId: 'order-1',
      email: 'rider@example.com',
      amount: 30,
      photographerContactNo: '0123456789',
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
    expect(payload.htmlbody).toContain('30.00');
    expect(payload.htmlbody).toContain('Contact us');
    expect(payload.htmlbody).toContain('Contact photographer');
    expect(payload.htmlbody).toContain('https://wa.me/60104459106?text=');
    expect(payload.htmlbody).toContain('https://wa.me/60123456789?text=');
    expect(payload.htmlbody).toContain('%23ORDER-1');
    expect(payload.htmlbody).not.toContain('Try Again');
    expect(payload.htmlbody).not.toContain('/cart');
  });

  it('points contact photographer at the platform number when the photographer has none', async () => {
    sendMailMock.mockResolvedValue({ ok: true });

    await service.sendPaymentFailedEmail({
      orderId: 'order-1',
      email: 'rider@example.com',
      amount: 30,
      photographerContactNo: null,
    });

    const html: string = sendMailMock.mock.calls[0][0].htmlbody;
    expect(html.match(/https:\/\/wa\.me\/60104459106\?text=/g)).toHaveLength(2);
  });

  it('uses PLATFORM_CONTACT_WHATSAPP for the contact-us link when set', async () => {
    sendMailMock.mockResolvedValue({ ok: true });
    process.env.PLATFORM_CONTACT_WHATSAPP = '60111111111';

    try {
      await service.sendPaymentFailedEmail({
        orderId: 'order-1',
        email: 'rider@example.com',
        amount: 30,
        photographerContactNo: '0123456789',
      });
    } finally {
      delete process.env.PLATFORM_CONTACT_WHATSAPP;
    }

    const html: string = sendMailMock.mock.calls[0][0].htmlbody;
    expect(html).toContain('https://wa.me/60111111111?text=');
    expect(html).not.toContain('https://wa.me/60104459106');
  });

  it('does not throw when ZeptoMail rejects the send', async () => {
    sendMailMock.mockRejectedValue(new Error('ZeptoMail is down'));

    await expect(
      service.sendPaymentFailedEmail({
        orderId: 'order-1',
        email: 'rider@example.com',
        amount: 30,
        photographerContactNo: '0123456789',
      }),
    ).resolves.toBeUndefined();
  });
});
