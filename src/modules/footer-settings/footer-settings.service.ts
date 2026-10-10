import { Injectable } from '@nestjs/common';
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
    return this.formatSettings(await this.current());
  }

  /** The footer is a single row; if duplicates ever appear the latest edit wins. */
  private async current(): Promise<FooterSettings> {
    const [latest] = await this.footerSettingsRepository.find({ order: { updatedAt: 'DESC' }, take: 1 });
    return latest ?? this.createDefaultSettings();
  }

  private formatSettings(settings: FooterSettings) {
    return {
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
  }

  async updateSettings(updateDto: UpdateFooterSettingsDto) {
    const settings = await this.current();
    const fields = [
      'aboutText',
      'socialLinks',
      'customSections',
      'contactInfo',
      'copyrightText',
      'showCategories',
      'maxCategoriesDisplay',
    ] as const;
    for (const field of fields) {
      if (updateDto[field] !== undefined) (settings as any)[field] = updateDto[field];
    }
    return this.formatSettings(await this.footerSettingsRepository.save(settings));
  }

  private async createDefaultSettings(): Promise<FooterSettings> {
    const defaultSettings = this.footerSettingsRepository.create({
      aboutText:
        'Designer kurtis and artificial jewellery, designed in Jaipur with new pieces every season.',
      socialLinks: [],
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
        email: '',
        address: '',
      },
      copyrightText: '© PariBelle. All rights reserved.',
      showCategories: true,
      maxCategoriesDisplay: 6,
    });

    return this.footerSettingsRepository.save(defaultSettings);
  }
}
