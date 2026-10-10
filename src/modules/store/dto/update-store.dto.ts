import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

const filled = (value: unknown) => value !== '' && value != null;

/**
 * The business details printed on invoices and labels. Every field is
 * optional so a form can send only what changed; an empty string clears one.
 */
export class UpdateStoreDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  storeName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  businessName?: string;

  @IsOptional()
  @ValidateIf((o) => filled(o.gstNumber))
  @Matches(/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, { message: 'That does not look like a 15-character GSTIN.' })
  gstNumber?: string;

  @IsOptional()
  @ValidateIf((o) => filled(o.panNumber))
  @Matches(/^[A-Z]{5}\d{4}[A-Z]$/, { message: 'A PAN is 5 letters, 4 digits, 1 letter.' })
  panNumber?: string;

  @IsOptional()
  @ValidateIf((o) => filled(o.contactEmail))
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  contactPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @IsOptional()
  @ValidateIf((o) => filled(o.postalCode))
  @Matches(/^\d{6}$/, { message: 'A pincode is 6 digits.' })
  postalCode?: string;
}

export class StorePolicyDto {
  @IsBoolean()
  enabled: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  days?: number;

  @IsString()
  @MaxLength(5000)
  text: string;
}

/** `null` clears the store's own policy, so the shop-wide setting applies. */
export class UpdateStorePoliciesDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => StorePolicyDto)
  returnPolicy?: StorePolicyDto | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => StorePolicyDto)
  cancellationPolicy?: StorePolicyDto | null;
}
