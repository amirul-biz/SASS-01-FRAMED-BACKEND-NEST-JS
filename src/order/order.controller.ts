import { Body, Controller, Post, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateOrderDto, OrderResponseDto } from './order.dto';
import { OrderService } from './order.service';

// Rider-facing and unauthenticated — no rider accounts exist in this app, matching the public
// surface already exposed by ClientController.
@ApiTags('orders')
@Controller('orders')
@UsePipes(new ValidationPipe({ transform: true }))
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  async create(@Body() dto: CreateOrderDto): Promise<OrderResponseDto> {
    return await this.orderService.create(dto);
  }
}
