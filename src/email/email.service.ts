import { Injectable, Logger } from '@nestjs/common';
import { SendMailClient } from 'zeptomail';
import {
  getPaymentFailedEmailHtml,
  getPhotosDeliveredEmailHtml,
} from './email.templates';

export interface SendPhotosDeliveredEmailParams {
  orderId: string;
  email: string;
  amount: number;
}

export interface SendPaymentFailedEmailParams {
  orderId: string;
  email: string;
  amount: number;
  // The event photographer's contactNo ?? phone; null/empty falls back to the platform number.
  photographerContactNo: string | null;
}

const DEFAULT_PLATFORM_CONTACT_WHATSAPP = '60104459106';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly client = new SendMailClient({
    url: process.env.ZEPTOMAIL_URL ?? 'https://cpaas.zoho.com/v1.1/email',
    token: process.env.ZEPTOMAIL_TOKEN ?? '',
  });

  // Fire-and-log, never fire-and-throw: this runs right after deliverOrder's guarded updateMany
  // already flipped the order to DELIVERED. A failed send here must never bubble up and look like
  // the delivery itself failed — the order staying DELIVERED with no email sent is a known,
  // separate gap (tracked for a follow-up reconciliation check), not something this call can fix
  // by throwing.
  async sendPhotosDeliveredEmail(
    params: SendPhotosDeliveredEmailParams,
  ): Promise<void> {
    const receiptLink = `${this.getClientUrl()}${this.getReceiptPath()}?orderId=${params.orderId}`;
    const imageLink = `${this.getClientUrl()}${this.getImagePath()}?orderId=${params.orderId}`;

    await this.sendOrLog({
      email: params.email,
      subject: 'Thank you for your order!',
      htmlbody: getPhotosDeliveredEmailHtml({
        amount: params.amount,
        receiptLink,
        imageLink,
      }),
      logContext: `delivery email for order ${params.orderId}`,
    });
  }

  // Same fire-and-log contract as sendPhotosDeliveredEmail — this runs right after
  // markPaymentAsFailed already committed the CANCELLED transition. A failed send here must never
  // look like the cancellation itself failed.
  async sendPaymentFailedEmail(
    params: SendPaymentFailedEmailParams,
  ): Promise<void> {
    const platformNumber = this.getPlatformContactNumber();
    const message = `Hi, my payment for order #${params.orderId.slice(0, 8).toUpperCase()} failed and I need help.`;

    await this.sendOrLog({
      email: params.email,
      subject: 'Your payment could not be completed',
      htmlbody: getPaymentFailedEmailHtml({
        amount: params.amount,
        contactUsLink: this.getWhatsAppLink(platformNumber, message),
        contactPhotographerLink: this.getWhatsAppLink(
          params.photographerContactNo || platformNumber,
          message,
        ),
      }),
      logContext: `payment-failed email for order ${params.orderId}`,
    });
  }

  private async sendOrLog(params: {
    email: string;
    subject: string;
    htmlbody: string;
    logContext: string;
  }): Promise<void> {
    try {
      await this.client.sendMail({
        from: {
          address: process.env.ZEPTOMAIL_FROM_ADDRESS ?? 'noreply@framed.app',
          name: process.env.ZEPTOMAIL_FROM_NAME ?? 'FRAMED',
        },
        to: [
          {
            email_address: { address: params.email, name: params.email },
          },
        ],
        subject: params.subject,
        htmlbody: params.htmlbody,
      });
      this.logger.log(`Sent ${params.logContext} to ${params.email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send ${params.logContext}: ${(error as Error).message}`,
      );
    }
  }

  private getPlatformContactNumber(): string {
    return (
      process.env.PLATFORM_CONTACT_WHATSAPP ?? DEFAULT_PLATFORM_CONTACT_WHATSAPP
    );
  }

  // Mirrors the frontend's toWhatsAppNumber (shared/whatsapp-number.util.ts): photographers enter
  // local Malaysian numbers (leading 0, no country code) but wa.me needs the full international
  // number.
  // ponytail: assumes MY, same as the frontend util; add a country field if that changes.
  private getWhatsAppLink(rawNumber: string, message: string): string {
    const digits = rawNumber.replace(/\D/g, '');
    const international = digits.startsWith('60')
      ? digits
      : `60${digits.replace(/^0+/, '')}`;
    return `https://wa.me/${international}?text=${encodeURIComponent(message)}`;
  }

  private getClientUrl(): string {
    return process.env.CLIENT_URL ?? 'http://localhost:4200';
  }

  private getReceiptPath(): string {
    return process.env.RECEIPT_URL ?? '/order-receipt';
  }

  private getImagePath(): string {
    return process.env.IMAGE_URL ?? '/order-images';
  }
}
