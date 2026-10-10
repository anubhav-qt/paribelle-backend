import { PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateHsnCodeDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/\s+/g, '') : value))
  @Matches(/^\d{4,8}$/, { message: 'An HSN code is 4 to 8 digits' })
  code: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  description: string;

  /** Percent. */
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(40)
  gstRate: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  category?: string;
}

export class UpdateHsnCodeDto extends PartialType(CreateHsnCodeDto) {}
