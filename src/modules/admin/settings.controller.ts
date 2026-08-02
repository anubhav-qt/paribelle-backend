import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/user.entity';
import { SettingsService } from './settings.service';

/**
 * Reads are public — the storefront needs the store name, currency and logo
 * before anyone logs in. Every write is admin-only.
 */
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.VENDOR_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all settings with metadata (admin only)' })
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.VENDOR_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create or update setting (admin only)' })
  async createOrUpdateSetting(
    @Body() body: { key: string; value: any; description?: string; type?: string }
  ) {
    return this.settingsService.updateSetting(body.key, body.value, body.description);
  }

  @Put(':key')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.VENDOR_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update setting (admin only)' })
  async updateSetting(
    @Param('key') key: string,
    @Body() body: { value: any; description?: string }
  ) {
    return this.settingsService.updateSetting(key, body.value, body.description);
  }

  @Delete(':key')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete setting (admin only)' })
  async deleteSetting(@Param('key') key: string) {
    await this.settingsService.deleteSetting(key);
    return { message: 'Setting deleted successfully' };
  }

  @Get('admin/notification-email')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.VENDOR_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get admin notification email (admin only)' })
  async getAdminNotificationEmail() {
    const email = await this.settingsService.getAdminNotificationEmail();
    return { 
      key: 'admin_notification_email',
      value: email,
      description: 'Email address for receiving admin notifications (KYC, orders, alerts)'
    };
  }

  @Post('admin/notification-email')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set admin notification email (admin only)' })
  async setAdminNotificationEmail(@Body() body: { email: string }) {
    if (!body.email || !body.email.includes('@')) {
      return { 
        success: false, 
        message: 'Invalid email address' 
      };
    }
    
    const setting = await this.settingsService.setAdminNotificationEmail(body.email);
    return { 
      success: true,
      message: 'Admin notification email updated successfully',
      data: setting
    };
  }
}
