import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SiteSetting } from './settings.entity';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(SiteSetting)
    private settingsRepository: Repository<SiteSetting>,
  ) {}

  async getSetting(key: string): Promise<any> {
    const setting = await this.settingsRepository.findOne({ where: { key } });
    return setting?.value;
  }

  async getSettings(): Promise<SiteSetting[]> {
    return this.settingsRepository.find();
  }

  async updateSetting(key: string, value: any, description?: string): Promise<SiteSetting> {
    let setting = await this.settingsRepository.findOne({ where: { key } });
    
    // If the incoming value is a string that looks like it's already JSON-encoded
    // (starts and ends with quotes), parse it first to avoid double-encoding
    let processedValue = value;
    if (typeof value === 'string' && value.startsWith('"') && value.endsWith('"') && value.length > 2) {
      try {
        processedValue = JSON.parse(value);
      } catch (e) {
        // If parsing fails, use original value
        processedValue = value;
      }
    }
    
    if (setting) {
      setting.value = processedValue;
      if (description) setting.description = description;
    } else {
      setting = this.settingsRepository.create({ key, value: processedValue, description });
    }
    
    return this.settingsRepository.save(setting);
  }

  async deleteSetting(key: string): Promise<void> {
    await this.settingsRepository.delete({ key });
  }

  // Helper method to get location filter enabled status
  async isLocationFilterEnabled(): Promise<boolean> {
    const value = await this.getSetting('location_filter_enabled');
    return value !== false; // Default to true if not set
  }
}
