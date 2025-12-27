import { IsString, IsBoolean, IsArray, IsOptional, IsInt, Min, Max, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class SocialLinkDto {
  @IsString()
  platform: 'facebook' | 'twitter' | 'instagram' | 'linkedin' | 'youtube' | 'tiktok';

  @IsString()
  url: string;

  @IsBoolean()
  enabled: boolean;
}

class FooterLinkDto {
  @IsString()
  label: string;

  @IsString()
  url: string;
}

class FooterSectionDto {
  @IsString()
  title: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FooterLinkDto)
  links: FooterLinkDto[];

  @IsBoolean()
  enabled: boolean;
}

class ContactInfoDto {
  @IsString()
  phone: string;

  @IsString()
  email: string;

  @IsString()
  address: string;
}

export class UpdateFooterSettingsDto {
  @IsOptional()
  @IsString()
  aboutText?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SocialLinkDto)
  socialLinks?: SocialLinkDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FooterSectionDto)
  customSections?: FooterSectionDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ContactInfoDto)
  contactInfo?: ContactInfoDto;

  @IsOptional()
  @IsString()
  copyrightText?: string;

  @IsOptional()
  @IsBoolean()
  showCategories?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  maxCategoriesDisplay?: number;
}
