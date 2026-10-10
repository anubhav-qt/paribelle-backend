import { IsString, IsOptional, IsEnum, IsBoolean, IsInt } from 'class-validator';
import { PageType, PageStatus } from '../entities/vendor-page.entity';

export class CreateVendorPageDto {
  @IsString()
  title: string;

  @IsString()
  slug: string;

  @IsEnum(PageType)
  @IsOptional()
  pageType?: PageType;

  @IsString()
  content: string;

  @IsString()
  @IsOptional()
  excerpt?: string;

  @IsString()
  @IsOptional()
  featuredImage?: string;

  @IsOptional()
  images?: string[];

  @IsString()
  @IsOptional()
  metaTitle?: string;

  @IsString()
  @IsOptional()
  metaDescription?: string;

  @IsString()
  @IsOptional()
  metaKeywords?: string;

  @IsEnum(PageStatus)
  @IsOptional()
  status?: PageStatus;

  @IsInt()
  @IsOptional()
  order?: number;

  @IsBoolean()
  @IsOptional()
  showInNavigation?: boolean;

  @IsBoolean()
  @IsOptional()
  isHomePage?: boolean;
}
