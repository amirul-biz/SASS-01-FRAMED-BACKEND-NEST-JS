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
import { PricingOptionsService } from './pricing-options.service';
import {
  CreatePricingOptionDto,
  PricingOptionResponseDto,
  UpdatePricingOptionDto,
} from './pricing-options.dto';
import { CurrentPhotographerId } from '../common/decorators/current-photographer-id.decorator';
import { FirebaseAuthGuard } from '../common/guards/firebase-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../../generated/prisma/enums';

@ApiTags('pricing-options')
@ApiBearerAuth()
@Controller('pricing-options')
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles(UserRole.PHOTOGRAPHER)
@UsePipes(new ValidationPipe({ transform: true }))
export class PricingOptionsController {
  constructor(private readonly service: PricingOptionsService) {}

  @Get()
  list(@CurrentPhotographerId() photographerId: string): Promise<PricingOptionResponseDto[]> {
    return this.service.list(photographerId);
  }

  @Post()
  create(
    @CurrentPhotographerId() photographerId: string,
    @Body() dto: CreatePricingOptionDto,
  ): Promise<PricingOptionResponseDto> {
    return this.service.create(photographerId, dto);
  }

  @Patch(':id')
  update(
    @CurrentPhotographerId() photographerId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePricingOptionDto,
  ): Promise<PricingOptionResponseDto> {
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