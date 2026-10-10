import { Controller, Get, Post, Put, Delete, Param, Body, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AdminOnly } from '../../common/decorators/admin-only.decorator';
import { UserRole } from '../users/user.entity';
import { SettingsService } from './settings.service';

/** Settings that only admins may read. */
const PRIVATE_KEYS = new Set(['admin_notification_email']);

/** Values saved as JSON text (by older admin screens) come back as the objects they encode. */
function decode(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const quoted = value.startsWith('"') && value.endsWith('"');
  const structured = (value.startsWith('[') && value.endsWith(']')) || (value.startsWith('{') && value.endsWith('}'));
  if (!quoted && !structured) return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/**
 * Reads are public — the storefront needs the store name, currency and logo
 * before anyone logs in. Every write is admin-only.
 */
@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all public settings as a key/value object' })
  async getPublicSettings() {
    const settings = await this.settingsService.getSettings();
    return Object.fromEntries(
      settings.filter((s) => !PRIVATE_KEYS.has(s.key)).map((s) => [s.key, decode(s.value)]),
    );
  }

  @Get('admin/all')
  @AdminOnly()
  @ApiOperation({ summary: 'Get all settings with metadata (admin only)' })
  async getAllSettings() {
    const settings = await this.settingsService.getSettings();
    return settings.map((s) => ({ ...s, value: decode(s.value) }));
  }

  @Get(':key')
  @ApiOperation({ summary: 'Get a public setting by key' })
  async getSetting(@Param('key') key: string) {
    if (PRIVATE_KEYS.has(key)) throw new NotFoundException();
    return { key, value: decode(await this.settingsService.getSetting(key)) };
  }

  @Post()
  @AdminOnly()
  @ApiOperation({ summary: 'Create or update setting (admin only)' })
  createOrUpdateSetting(@Body() body: { key: string; value: any; description?: string }) {
    return this.settingsService.updateSetting(body.key, body.value, body.description);
  }

  @Put(':key')
  @AdminOnly()
  @ApiOperation({ summary: 'Update setting (admin only)' })
  updateSetting(@Param('key') key: string, @Body() body: { value: any; description?: string }) {
    return this.settingsService.updateSetting(key, body.value, body.description);
  }

  @Delete(':key')
  @AdminOnly(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete setting (super admin only)' })
  async deleteSetting(@Param('key') key: string) {
    await this.settingsService.deleteSetting(key);
    return { message: 'Setting deleted successfully' };
  }
}
