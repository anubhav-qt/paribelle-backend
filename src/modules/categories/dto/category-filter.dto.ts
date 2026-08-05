import { IsString, IsEnum, IsOptional, IsArray, ValidateNested, IsNumber, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export enum FilterType {
  SELECT = 'select',
  MULTISELECT = 'multiselect',
  CHECKBOX = 'checkbox',
  RANGE = 'range',
}

export class FilterOptionDto {
  @ApiProperty({ example: 'Nike' })
  @IsString()
  label: string;

  @ApiProperty({ example: 'nike' })
  @IsString()
  value: string;
}

export class CategoryFilterDto {
  @ApiProperty({ example: 'brand' })
  @IsString()
  id: string;

  @ApiProperty({ example: 'Brand' })
  @IsString()
  label: string;

  @ApiProperty({ enum: FilterType, example: FilterType.CHECKBOX })
  @IsEnum(FilterType)
  type: FilterType;

  @ApiProperty({ type: [FilterOptionDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FilterOptionDto)
  options?: FilterOptionDto[];

  @ApiProperty({ required: false, example: 0 })
  @IsOptional()
  @IsNumber()
  min?: number;

  @ApiProperty({ required: false, example: 10000 })
  @IsOptional()
  @IsNumber()
  max?: number;

  @ApiProperty({ required: false, example: 100 })
  @IsOptional()
  @IsNumber()
  step?: number;

  /**
   * Overrides for a filter derived from the catalogue (see
   * `CategoriesService.getEffectiveFilters`). `options` on a derived filter is
   * ignored — options come from what products actually carry, never from
   * hand-typed entries here.
   */
  @ApiProperty({ required: false, example: 0, description: 'Display order among effective filters' })
  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @ApiProperty({ required: false, example: false, description: 'Hide this filter on the storefront' })
  @IsOptional()
  @IsBoolean()
  hidden?: boolean;
}

export class UpdateCategoryFiltersDto {
  @ApiProperty({ type: [CategoryFilterDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CategoryFilterDto)
  filters: CategoryFilterDto[];
}
