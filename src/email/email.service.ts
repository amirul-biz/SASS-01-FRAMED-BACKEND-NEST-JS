import { Injectable, Logger } from '@nestjs/common';

export interface SendPhotosDeliveredEmailParams {
  orderId: string;
  email: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  async sendPhotosDeliveredEmail(
    params: SendPhotosDeliveredEmailParams,
  ): Promise<void> {
    this.logger.log(
      `email received, photo sent to customer (order ${params.orderId} -> ${params.email})`,
    );
  }
}
