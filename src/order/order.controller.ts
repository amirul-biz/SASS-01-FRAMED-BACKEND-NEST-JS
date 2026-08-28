import { Body, Controller, Get, Post, Query, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { FirebaseAuthGuard } from '../common/guards/firebase-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../../generated/prisma/enums';
import type { AuthenticatedUser } from '../types/express';
import {
  CreateOrderDto,
  OrderListQueryDto,
  OrderResponseDto,
  PaginatedOrderListResponseDto,
} from './order.dto';
import { OrderService } from './order.service';

@ApiTags('orders')
@Controller('orders')
@UsePipes(new ValidationPipe({ transform: true }))
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  // Rider-facing and unauthenticated — no rider accounts exist in this app, matching the public
  // surface already exposed by ClientController.
  @Post()
  async create(@Body() dto: CreateOrderDto): Promise<OrderResponseDto> {
    return await this.orderService.create(dto);
  }

  // Photographer-facing — lists orders across the caller's own events only.
  @Get()
  @ApiBearerAuth()
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles(UserRole.PHOTOGRAPHER)
  async listMyOrders(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: OrderListQueryDto,
  ): Promise<PaginatedOrderListResponseDto> {
    return await this.orderService.listForPhotographer(user, query);
  }
}
