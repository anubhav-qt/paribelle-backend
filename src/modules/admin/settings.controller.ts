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
      let value = setting.value;
      
      // If value is a string, try to parse it as JSON
      if (typeof value === 'string') {
        // Check if it starts with quotes (JSON string)
        if (value.startsWith('"') && value.endsWith('"')) {
          try {
            value = JSON.parse(value);
          } catch (e) {
            // If parsing fails, use original value
          }
        }
        // Check if it starts with [ or { (JSON array or object)
        else if ((value.startsWith('[') && value.endsWith(']')) || 
                 (value.startsWith('{') && value.endsWith('}'))) {
          try {
            value = JSON.parse(value);
          } catch (e) {
            // If parsing fails, use original value
          }
        }
      }
      
      settingsObj[setting.key] = value;
    });
    return settingsObj;
  }

  @Get('admin/all')
  @ApiOperation({ summary: 'Get all settings with metadata' })
  async getAllSettings() {
    const settings = await this.settingsService.getSettings();
    // Parse any string values that look like JSON to actual objects/arrays
    return settings.map(setting => {
      let value = setting.value;
      
      // If value is a string, try to parse it as JSON
      if (typeof value === 'string') {
        // Check if it starts with quotes (JSON string)
        if (value.startsWith('"') && value.endsWith('"')) {
          try {
            value = JSON.parse(value);
          } catch (e) {
            // If parsing fails, use original value
          }
        }
        // Check if it starts with [ or { (JSON array or object)
        else if ((value.startsWith('[') && value.endsWith(']')) || 
                 (value.startsWith('{') && value.endsWith('}'))) {
          try {
            value = JSON.parse(value);
          } catch (e) {
            // If parsing fails, use original value
          }
        }
      }
      
      return { ...setting, value };
    });
  }

  @Get(':key')
  @ApiOperation({ summary: 'Get setting by key' })
  async getSetting(@Param('key') key: string) {
    const value = await this.settingsService.getSetting(key);
    let parsedValue = value;
    
    // If value is a string, try to parse it as JSON
    if (typeof value === 'string') {
      // Check if it starts with quotes (JSON string)
      if (value.startsWith('"') && value.endsWith('"')) {
        try {
          parsedValue = JSON.parse(value);
        } catch (e) {
          parsedValue = value;
        }
      }
      // Check if it starts with [ or { (JSON array or object)
      else if ((value.startsWith('[') && value.endsWith(']')) || 
               (value.startsWith('{') && value.endsWith('}'))) {
        try {
          parsedValue = JSON.parse(value);
        } catch (e) {
          parsedValue = value;
        }
      }
    }
    
    return { key, value: parsedValue };
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
