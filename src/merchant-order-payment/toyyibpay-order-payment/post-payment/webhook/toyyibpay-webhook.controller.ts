import {
  Body,
  Controller,
  HttpCode,
  Post,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { ToyyibPayWebhookCallbackDto } from './toyyibpay-webhook.dto';
import { ToyyibPayWebhookService } from './toyyibpay-webhook.service';

@Controller('toyyibpay-order-payment/post-payment')
@UsePipes(new ValidationPipe({ transform: true }))
export class ToyyibPayWebhookController {
  constructor(
    private readonly toyyibPayWebhookService: ToyyibPayWebhookService,
  ) {}

  // ToyyibPay sends the callback as multipart/form-data, not JSON or urlencoded — AnyFilesInterceptor
  // (multer) is what actually populates @Body() with the text fields for that content type.
  @Post('webhook')
  @HttpCode(200)
  @UseInterceptors(AnyFilesInterceptor())
  async receiveWebhookCallback(
    @Body() dto: ToyyibPayWebhookCallbackDto,
  ): Promise<{ received: true }> {
    await this.toyyibPayWebhookService.handleCallback(dto);
    return { received: true };
  }
}
