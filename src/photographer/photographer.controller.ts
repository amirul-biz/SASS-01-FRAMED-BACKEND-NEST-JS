import {
  Body,
  Controller,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  RegisterPhotographerInputDto,
  RegisterPhotographerOutputDto,
} from './photographer.dto';
import { PhotographerService } from './photographer.service';

@Controller('photographer')
export class PhotographerController {
  constructor(private readonly photographerService: PhotographerService) {}

  @Post('register')
  @UsePipes(new ValidationPipe({ transform: true }))
  async register(
    @Body() dto: RegisterPhotographerInputDto,
  ): Promise<RegisterPhotographerOutputDto> {
    return await this.photographerService.registerPhotographer(dto);
  }
}
