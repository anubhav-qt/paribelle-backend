import { IsString, IsOptional, IsEnum, IsArray, MaxLength } from 'class-validator';
import { PageStatus } from '../entities/vendor-page.entity';

export class CreateBlogPostDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsString()
  @MaxLength(250)
  slug: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  excerpt?: string;

  @IsOptional()
  @IsString()
  featuredImage?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsEnum(PageStatus)
  status?: PageStatus;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  authorName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  metaTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  metaDescription?: string;
}
