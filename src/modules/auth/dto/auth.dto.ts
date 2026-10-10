import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class RegisterDto {
  @Transform(trim)
  @IsEmail({}, { message: 'Please enter a valid email address.' })
  @MaxLength(254)
  email: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters.' })
  // bcrypt only reads the first 72 bytes.
  @MaxLength(72, { message: 'Password must be at most 72 characters.' })
  password: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Please enter your first name.' })
  @MaxLength(60)
  firstName: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Please enter your last name.' })
  @MaxLength(60)
  lastName: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;
}

export class GoogleLoginDto {
  @IsString()
  @IsNotEmpty()
  accessToken: string;
}

export class ForgotPasswordDto {
  @Transform(trim)
  @IsEmail({}, { message: 'Please enter a valid email address.' })
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters.' })
  @MaxLength(72, { message: 'Password must be at most 72 characters.' })
  newPassword: string;
}
