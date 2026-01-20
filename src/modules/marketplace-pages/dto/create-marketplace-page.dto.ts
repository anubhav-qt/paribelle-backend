import { IsString, IsEnum, IsOptional, IsBoolean } from 'class-validator';
import { PageType, PageStatus } from '../entities/marketplace-page.entity';

export class CreateMarketplacePageDto {
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

  @IsString({ each: true })
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

  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsString()
  @IsOptional()
  authorName?: string;

  @IsEnum(PageStatus)
  @IsOptional()
  status?: PageStatus;

  @IsBoolean()
  @IsOptional()
  showInNavigation?: boolean;
}
