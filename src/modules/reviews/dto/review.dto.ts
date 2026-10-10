import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, IsUrl, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class UpdateReviewDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsString()
  @MaxLength(2000)
  comment: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @IsUrl({ protocols: ['https'], require_protocol: true }, { each: true })
  images?: string[];
}

/** Reviews come from buyers only: the order line is the proof of purchase. */
export class CreateReviewDto extends UpdateReviewDto {
  @IsUUID()
  productId: string;

  @IsUUID()
  orderItemId: string;
}
