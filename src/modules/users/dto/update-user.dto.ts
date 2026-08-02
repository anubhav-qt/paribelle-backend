import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { UserStatus } from '../user.entity';

/**
 * Fields an admin may change on someone else's account.
 *
 * `role`, `password`, `emailVerifiedAt` and the reset-token columns are
 * deliberately absent — the global ValidationPipe runs with
 * `forbidNonWhitelisted`, so a request that tries to set them is rejected
 * rather than silently ignored. Role changes belong in their own audited
 * endpoint.
 */
export class UpdateUserDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}
