import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PricingOptionsService } from './pricing-options.service';
import {
  CreatePricingOptionDto,
  PricingOptionResponseDto,
  UpdatePricingOptionDto,
} from './pricing-options.dto';
import { CurrentPhotographerId } from '../common/decorators/current-photographer-id.decorator';

@ApiTags('pricing-options')
@Controller('pricing-options')
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