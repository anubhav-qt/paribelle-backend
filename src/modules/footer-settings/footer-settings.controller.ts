import { Controller, Get, Put, Body, UseGuards, HttpCode, HttpStatus, UseInterceptors, ClassSerializerInterceptor } from '@nestjs/common';
import { FooterSettingsService } from './footer-settings.service';
import { UpdateFooterSettingsDto } from './dto/update-footer-settings.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('footer-settings')
export class FooterSettingsController {
  constructor(private readonly footerSettingsService: FooterSettingsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(ClassSerializerInterceptor)
  async getSettings() {
    console.log('🟢 [FooterSettingsController] GET /footer-settings called');
    const result = await this.footerSettingsService.getSettings();
    console.log('🟢 [FooterSettingsController] Service returned, keys:', Object.keys(result));
    return result;
  }

  @Put()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async updateSettings(@Body() updateDto: UpdateFooterSettingsDto) {
    console.log('🟢 [FooterSettingsController] PUT /footer-settings called');
    console.log('🟢 [FooterSettingsController] Raw body keys:', Object.keys(updateDto));
    console.log('🟢 [FooterSettingsController] customSections count:', updateDto.customSections?.length);
    const result = await this.footerSettingsService.updateSettings(updateDto);
    console.log('🟢 [FooterSettingsController] Update completed');
    return result;
  }
}
