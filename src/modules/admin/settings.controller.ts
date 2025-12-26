import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all settings (public)' })
  async getPublicSettings() {
    const settings = await this.settingsService.getSettings();
    // Return as key-value object for easier frontend consumption
    const settingsObj: Record<string, any> = {};
    settings.forEach(setting => {
      settingsObj[setting.key] = setting.value;
    });
    return settingsObj;
  }

  @Get('admin/all')
  @ApiOperation({ summary: 'Get all settings with metadata' })
  async getAllSettings() {
    return this.settingsService.getSettings();
  }

  @Get(':key')
  @ApiOperation({ summary: 'Get setting by key' })
  async getSetting(@Param('key') key: string) {
    return { key, value: await this.settingsService.getSetting(key) };
  }

  @Post()
  @ApiOperation({ summary: 'Create or update setting' })
  async createOrUpdateSetting(
    @Body() body: { key: string; value: any; description?: string; type?: string }
  ) {
    return this.settingsService.updateSetting(body.key, body.value, body.description);
  }

  @Put(':key')
  @ApiOperation({ summary: 'Update setting' })
  async updateSetting(
    @Param('key') key: string,
    @Body() body: { value: any; description?: string }
  ) {
    return this.settingsService.updateSetting(key, body.value, body.description);
  }

  @Delete(':key')
  @ApiOperation({ summary: 'Delete setting' })
  async deleteSetting(@Param('key') key: string) {
    await this.settingsService.deleteSetting(key);
    return { message: 'Setting deleted successfully' };
  }
}
