import { Controller, Get, Param, Query, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import {
  ClientEventDetailDto,
  ClientEventListQueryDto,
  ClientEventPhotoListQueryDto,
  ClientHomeResponseDto,
  ClientPhotographerListQueryDto,
  ClientPhotographerProfileDto,
  ClientTopPhotographerDto,
  PaginatedClientEventListResponseDto,
  PaginatedClientEventPhotoListResponseDto,
} from './client.dto';
import { ClientService } from './client.service';

@Controller('client')
export class ClientController {
  constructor(private readonly clientService: ClientService) {}

  @Get('home')
  @ApiOkResponse({ type: ClientHomeResponseDto })
  async getHome(): Promise<ClientHomeResponseDto> {
    return await this.clientService.getHomeData();
  }

  @Get('events')
  @ApiOkResponse({ type: PaginatedClientEventListResponseDto })
  @UsePipes(new ValidationPipe({ transform: true }))
  async getEvents(
    @Query() query: ClientEventListQueryDto,
  ): Promise<PaginatedClientEventListResponseDto> {
    return await this.clientService.getEventList(query);
  }

  @Get('events/:id')
  @ApiOkResponse({ type: ClientEventDetailDto })
  async getEvent(@Param('id') id: string): Promise<ClientEventDetailDto> {
    return await this.clientService.getEventDetail(id);
  }

  @Get('events/:id/photos')
  @ApiOkResponse({ type: PaginatedClientEventPhotoListResponseDto })
  @UsePipes(new ValidationPipe({ transform: true }))
  async getEventPhotos(
    @Param('id') id: string,
    @Query() query: ClientEventPhotoListQueryDto,
  ): Promise<PaginatedClientEventPhotoListResponseDto> {
    return await this.clientService.getEventPhotos(id, query);
  }

  @Get('photographers')
  @ApiOkResponse({ type: [ClientTopPhotographerDto] })
  @UsePipes(new ValidationPipe({ transform: true }))
  async getPhotographers(
    @Query() query: ClientPhotographerListQueryDto,
  ): Promise<ClientTopPhotographerDto[]> {
    return await this.clientService.getPhotographerList(query.search);
  }

  @Get('photographers/:id')
  @ApiOkResponse({ type: ClientPhotographerProfileDto })
  async getPhotographerProfile(
    @Param('id') id: string,
  ): Promise<ClientPhotographerProfileDto> {
    return await this.clientService.getPhotographerProfile(id);
  }
}
