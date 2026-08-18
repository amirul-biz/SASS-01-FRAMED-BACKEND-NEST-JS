import { ApiProperty } from '@nestjs/swagger';

export class CurrentUserResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;

  @ApiProperty({ type: [String], example: ['photographer'] })
  roles!: string[];
}
