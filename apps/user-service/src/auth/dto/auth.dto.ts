import { Transform } from 'class-transformer';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'person@example.com', description: 'Email address; trimmed and lowercased.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email!: string;

  @IsString()
  @ApiProperty({ example: 'correct-horse-battery', minLength: 8 })
  @MinLength(8)
  password!: string;
}

export class LoginDto {
  @ApiProperty({ example: 'person@example.com' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email!: string;

  @IsString()
  @ApiProperty({ example: 'correct-horse-battery', minLength: 8 })
  @MinLength(8)
  password!: string;
}
