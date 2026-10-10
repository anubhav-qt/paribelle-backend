import { PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
/** A blank optional field is no value, not an invalid one. */
const blankToUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;

export class CreateAddressDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Please enter the full name.' })
  @MaxLength(100)
  fullName: string;

  @Transform(blankToUndefined)
  @IsOptional()
  @IsEmail({}, { message: 'Please enter a valid email address.' })
  @MaxLength(254)
  email?: string;

  @Transform(trim)
  @Matches(/^\d{5,15}$/, { message: 'Please enter a valid phone number (5-15 digits).' })
  phone: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Please enter the address.' })
  @MaxLength(200)
  addressLine1: string;

  @Transform(blankToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine2?: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Please enter the city.' })
  @MaxLength(100)
  city: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Please enter the state.' })
  @MaxLength(100)
  state: string;

  @Transform(trim)
  @Matches(/^[A-Za-z0-9\s-]{3,10}$/, { message: 'Please enter a valid postal code.' })
  postalCode: string;

  @Transform(blankToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(60)
  country?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateAddressDto extends PartialType(CreateAddressDto) {}
