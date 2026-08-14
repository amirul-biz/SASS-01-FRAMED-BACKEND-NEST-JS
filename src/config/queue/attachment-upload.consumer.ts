import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { ATTACHMENT_UPLOADED_EVENT_PATTERN } from './attachment-queue.constants';
import type { AttachmentUploadedEvent } from './attachment-uploaded.event';

@Controller()
export class AttachmentUploadConsumer {
  private readonly logger = new Logger(AttachmentUploadConsumer.name);

  @EventPattern(ATTACHMENT_UPLOADED_EVENT_PATTERN)
  handleAttachmentUploaded(@Payload() event: AttachmentUploadedEvent): void {
    // Placeholder until attachment persistence (DB save) is implemented.
    this.logger.log(`Attachment uploaded: ${JSON.stringify(event)}`);
  }
}
