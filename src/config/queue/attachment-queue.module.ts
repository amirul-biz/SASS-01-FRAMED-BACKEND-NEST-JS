import { Module } from '@nestjs/common';
import { ClientsModule, RmqOptions, Transport } from '@nestjs/microservices';
import { AttachmentUploadConsumer } from './attachment-upload.consumer';
import {
  UPLOAD_ATTACHMENT_QUEUE_CLIENT,
  UPLOAD_ATTACHMENT_QUEUE_NAME,
} from './attachment-queue.constants';

function getAttachmentQueueTransportOptions(): RmqOptions {
  const cloudamqpUrl = process.env.CLOUDAMQP_URL;
  if (!cloudamqpUrl) {
    throw new Error(
      'CLOUDAMQP_URL is not configured. Please set it in your environment variables.',
    );
  }

  return {
    transport: Transport.RMQ,
    options: {
      urls: [cloudamqpUrl],
      queue: UPLOAD_ATTACHMENT_QUEUE_NAME,
      queueOptions: { durable: true },
    },
  };
}

export function getAttachmentQueueMicroserviceOptions(): RmqOptions {
  const options = getAttachmentQueueTransportOptions();
  return { ...options, options: { ...options.options, noAck: false } };
}

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: UPLOAD_ATTACHMENT_QUEUE_CLIENT,
        useFactory: getAttachmentQueueTransportOptions,
      },
    ]),
  ],
  controllers: [AttachmentUploadConsumer],
  exports: [ClientsModule],
})
export class AttachmentQueueModule {}
