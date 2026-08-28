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
import { PricingBundlesService } from './pricing-bundles.service';
import {
  CreatePricingBundleDto,
  PricingBundleResponseDto,
  UpdatePricingBundleDto,
} from './pricing-bundles.dto';
import { CurrentPhotographerId } from '../common/decorators/current-photographer-id.decorator';
import { FirebaseAuthGuard } from '../common/guards/firebase-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../../generated/prisma/enums';

@ApiTags('pricing-bundles')
@ApiBearerAuth()
@Controller('pricing-bundles')
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles(UserRole.PHOTOGRAPHER)
@UsePipes(new ValidationPipe({ transform: true }))
export class PricingBundlesController {
  constructor(private readonly service: PricingBundlesService) {}

  @Get()
  list(@CurrentPhotographerId() photographerId: string): Promise<PricingBundleResponseDto[]> {
    return this.service.list(photographerId);
  }

  @Get(':id')
  findOne(
    @CurrentPhotographerId() photographerId: string,
    @Param('id') id: string,
  ): Promise<PricingBundleResponseDto> {
    return this.service.findOne(photographerId, id);
  }

  @Post()
  create(
    @CurrentPhotographerId() photographerId: string,
    @Body() dto: CreatePricingBundleDto,
  ): Promise<PricingBundleResponseDto> {
    return this.service.create(photographerId, dto);
  }

  @Patch(':id')
  update(
    @CurrentPhotographerId() photographerId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePricingBundleDto,
  ): Promise<PricingBundleResponseDto> {
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