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
    
    if (setting) {
      setting.value = value;
      if (description) setting.description = description;
    } else {
      setting = this.settingsRepository.create({ key, value, description });
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
