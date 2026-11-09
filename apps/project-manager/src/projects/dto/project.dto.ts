import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateProjectDto {
  @ApiProperty({ example: 'My Website', maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;
}

export class GenerateProjectDto {
  @ApiProperty({ example: 'Create a modern portfolio site', maxLength: 4000 })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  prompt!: string;
}
