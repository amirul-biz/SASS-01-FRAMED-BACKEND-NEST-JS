import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { VouchersService } from './vouchers.service';
import { CreateVoucherDto, UpdateVoucherDto, VoucherResponseDto } from './vouchers.dto';
import { CurrentPhotographerId } from '../common/decorators/current-photographer-id.decorator';
import { FirebaseAuthGuard } from '../common/guards/firebase-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../../generated/prisma/enums';

@ApiTags('vouchers')
@ApiBearerAuth()
@Controller('vouchers')
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles(UserRole.PHOTOGRAPHER)
@UsePipes(new ValidationPipe({ transform: true }))
export class VouchersController {
  constructor(private readonly service: VouchersService) {}

  @Get()
  list(@CurrentPhotographerId() photographerId: string): Promise<VoucherResponseDto[]> {
    return this.service.list(photographerId);
  }

  @Get(':id')
  findOne(
    @CurrentPhotographerId() photographerId: string,
    @Param('id') id: string,
  ): Promise<VoucherResponseDto> {
    return this.service.findOne(photographerId, id);
  }

  @Post()
  create(
    @CurrentPhotographerId() photographerId: string,
    @Body() dto: CreateVoucherDto,
  ): Promise<VoucherResponseDto> {
    return this.service.create(photographerId, dto);
  }

  @Patch(':id')
  update(
    @CurrentPhotographerId() photographerId: string,
    @Param('id') id: string,
    @Body() dto: UpdateVoucherDto,
  ): Promise<VoucherResponseDto> {
    return this.service.update(photographerId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentPhotographerId() photographerId: string,
    @Param('id') id: string,
  ): Promise<void> {
    return this.service.remove(photographerId, id);
  }
}
