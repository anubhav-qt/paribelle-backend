import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FooterSettings } from './entities/footer-settings.entity';
import { UpdateFooterSettingsDto } from './dto/update-footer-settings.dto';

@Injectable()
export class FooterSettingsService {
  constructor(
    @InjectRepository(FooterSettings)
    private footerSettingsRepository: Repository<FooterSettings>,
  ) {}

  async getSettings() {
    console.log('🔵 [FooterSettings] getSettings called');
    
    // Check for multiple records (there should only be one)
    const allSettings = await this.footerSettingsRepository.find();
    console.log(`🔵 [FooterSettings] Found ${allSettings.length} record(s) in database`);
    
    if (allSettings.length > 1) {
      console.warn('⚠️ [FooterSettings] Multiple footer settings found! Cleaning up...');
      // Keep the most recently updated one, delete the rest
      const sorted = allSettings.sort((a, b) => 
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      const keepRecord = sorted[0];
      const deleteRecords = sorted.slice(1);
      
      for (const record of deleteRecords) {
        await this.footerSettingsRepository.remove(record);
        console.log(`🗑️ [FooterSettings] Deleted duplicate record ${record.id}`);
      }
      
      console.log(`✅ [FooterSettings] Kept most recent record ${keepRecord.id}`);
      return this.formatSettings(keepRecord);
    }
    
    let settings = allSettings[0];
    
    if (!settings) {
      // Create default settings if none exist
      console.log('🔵 [FooterSettings] Creating default settings');
      settings = await this.createDefaultSettings();
      console.log('🔵 [FooterSettings] Default settings created:', !!settings);
    }
    
    return this.formatSettings(settings);
  }

  private formatSettings(settings: FooterSettings) {
    // Return plain object without TypeORM metadata
    const result = {
      id: settings.id,
      aboutText: settings.aboutText,
      socialLinks: settings.socialLinks,
      customSections: settings.customSections,
      contactInfo: settings.contactInfo,
      copyrightText: settings.copyrightText,
      showCategories: settings.showCategories,
      maxCategoriesDisplay: settings.maxCategoriesDisplay,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    };
    
    console.log('🔵 [FooterSettings] Returning result:', {
      customSectionsCount: result.customSections?.length,
      socialLinksCount: result.socialLinks?.length,
    });
    
    return result;
  }

  async updateSettings(updateDto: UpdateFooterSettingsDto): Promise<FooterSettings> {
    console.log('🟡 [FooterSettings] updateSettings called');
    console.log('🟡 [FooterSettings] Incoming DTO keys:', Object.keys(updateDto));
    console.log('🟡 [FooterSettings] customSections:', JSON.stringify(updateDto.customSections, null, 2));
    console.log('🟡 [FooterSettings] socialLinks:', JSON.stringify(updateDto.socialLinks, null, 2));
    
    // Find all settings first to check for duplicates
    const allSettings = await this.footerSettingsRepository.find();
    console.log(`🟡 [FooterSettings] Found ${allSettings.length} record(s)`);
    
    let settings: FooterSettings;
    
    if (allSettings.length === 0) {
      console.log('🟡 [FooterSettings] No settings found, creating defaults');
      settings = await this.createDefaultSettings();
    } else if (allSettings.length > 1) {
      console.warn('⚠️ [FooterSettings] Multiple records found during update! Using most recent...');
      // Use the most recently updated one
      settings = allSettings.sort((a, b) => 
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )[0];
      
      // Delete the duplicates
      for (let i = 1; i < allSettings.length; i++) {
        await this.footerSettingsRepository.remove(allSettings[i]);
        console.log(`🗑️ Deleted duplicate ${allSettings[i].id}`);
      }
    } else {
      settings = allSettings[0];
    }
    
    console.log('🟡 [FooterSettings] Using settings ID:', settings.id);
    console.log('🟡 [FooterSettings] Current settings before update:', {
      id: settings.id,
      socialLinksCount: settings.socialLinks?.length,
      customSectionsCount: settings.customSections?.length,
    });
    
    // Explicitly update each field with deep copy to ensure proper persistence
    if (updateDto.aboutText !== undefined) {
      settings.aboutText = updateDto.aboutText;
    }
    
    if (updateDto.socialLinks !== undefined) {
      // Deep clone to ensure TypeORM detects changes
      settings.socialLinks = JSON.parse(JSON.stringify(updateDto.socialLinks));
      console.log('🟡 Updated socialLinks count:', settings.socialLinks.length);
    }
    
    if (updateDto.customSections !== undefined) {
      // Deep clone to ensure TypeORM detects changes
      settings.customSections = JSON.parse(JSON.stringify(updateDto.customSections));
      console.log('🟡 Updated customSections count:', settings.customSections.length);
      settings.customSections.forEach((section, idx) => {
        console.log(`🟡   Section ${idx}: ${section.title} with ${section.links?.length || 0} links`);
      });
    }
    
    if (updateDto.contactInfo !== undefined) {
      settings.contactInfo = JSON.parse(JSON.stringify(updateDto.contactInfo));
    }
    
    if (updateDto.copyrightText !== undefined) {
      settings.copyrightText = updateDto.copyrightText;
    }
    
    if (updateDto.showCategories !== undefined) {
      settings.showCategories = updateDto.showCategories;
    }
    
    if (updateDto.maxCategoriesDisplay !== undefined) {
      settings.maxCategoriesDisplay = updateDto.maxCategoriesDisplay;
    }
    
    console.log('🟡 [FooterSettings] About to save with:', {
      socialLinksCount: settings.socialLinks?.length,
      customSectionsCount: settings.customSections?.length,
    });
    
    const saved = await this.footerSettingsRepository.save(settings);
    
    console.log('🟡 [FooterSettings] Saved successfully with:', {
      id: saved.id,
      socialLinksCount: saved.socialLinks?.length,
      customSectionsCount: saved.customSections?.length,
    });
    
    return saved;
  }

  private async createDefaultSettings(): Promise<FooterSettings> {
    const defaultSettings = this.footerSettingsRepository.create({
      aboutText:
        'Designer kurtis and artificial jewellery, designed in Jaipur with new pieces every season.',
      socialLinks: [
        { platform: 'facebook', url: 'https://facebook.com', enabled: true },
        { platform: 'twitter', url: 'https://twitter.com', enabled: true },
        { platform: 'instagram', url: 'https://instagram.com', enabled: true },
        { platform: 'linkedin', url: 'https://linkedin.com', enabled: true },
      ],
      customSections: [
        {
          title: 'Help Center',
          enabled: true,
          links: [
            { label: 'Help Center', url: '/help' },
            { label: 'Contact Us', url: '/contact' },
            { label: 'Shipping Info', url: '/shipping' },
            { label: 'Returns', url: '/returns' },
            { label: 'FAQ', url: '/faq' },
            { label: 'Track Your Order', url: '/track-order' },
          ],
        },
        {
          title: 'My Account',
          enabled: true,
          links: [
            { label: 'Login / Register', url: '/login' },
            { label: 'My Dashboard', url: '/dashboard' },
            { label: 'Order History', url: '/orders' },
            { label: 'My Wishlist', url: '/wishlist' },
          ],
        },
        {
          title: 'Quick Links',
          enabled: true,
          links: [
            { label: 'Privacy Policy', url: '/privacy-policy' },
            { label: 'Terms of Service', url: '/terms-of-service' },
            { label: 'Cookie Policy', url: '/cookie-policy' },
          ],
        },
      ],
      contactInfo: {
        phone: '',
        email: 'hello@paribelle.com',
        address: '',
      },
      copyrightText: '© PariBelle. All rights reserved.',
      showCategories: true,
      maxCategoriesDisplay: 6,
    });

    return this.footerSettingsRepository.save(defaultSettings);
  }
}
