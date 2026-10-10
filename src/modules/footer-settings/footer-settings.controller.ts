import { Controller, Get, Put, Body } from '@nestjs/common';
import { FooterSettingsService } from './footer-settings.service';
import { UpdateFooterSettingsDto } from './dto/update-footer-settings.dto';
import { AdminOnly } from '../../common/decorators/admin-only.decorator';

@Controller('footer-settings')
export class FooterSettingsController {
  constructor(private readonly footerSettingsService: FooterSettingsService) {}

  @Get()
  getSettings() {
    return this.footerSettingsService.getSettings();
  }

  @Put()
  @AdminOnly()
  updateSettings(@Body() updateDto: UpdateFooterSettingsDto) {
    return this.footerSettingsService.updateSettings(updateDto);
  }
}
