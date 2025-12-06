import { IsString, IsEnum, IsOptional, IsArray, ValidateNested, IsNumber } from 'class-validator';
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
}

export class UpdateCategoryFiltersDto {
  @ApiProperty({ type: [CategoryFilterDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CategoryFilterDto)
  filters: CategoryFilterDto[];
}
