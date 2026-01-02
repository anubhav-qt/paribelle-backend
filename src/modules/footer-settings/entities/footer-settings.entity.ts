import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export interface SocialLink {
  platform: 'facebook' | 'twitter' | 'instagram' | 'linkedin' | 'youtube' | 'tiktok';
  url: string;
  enabled: boolean;
}

export interface FooterSection {
  title: string;
  links: Array<{
    label: string;
    url: string;
  }>;
  enabled: boolean;
}

export interface ContactInfo {
  phone: string;
  email: string;
  address: string;
}

@Entity('footer_settings')
export class FooterSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, name: 'about_text' })
  aboutText: string;

  @Column({ type: 'jsonb', default: '[]', name: 'social_links' })
  socialLinks: SocialLink[];

  @Column({ type: 'jsonb', default: '[]', name: 'custom_sections' })
  customSections: FooterSection[];

  @Column({ type: 'jsonb', name: 'contact_info' })
  contactInfo: ContactInfo;

  @Column({ type: 'text', nullable: true, name: 'copyright_text' })
  copyrightText: string;

  @Column({ type: 'boolean', default: true, name: 'show_categories' })
  showCategories: boolean;

  @Column({ type: 'int', default: 6, name: 'max_categories_display' })
  maxCategoriesDisplay: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
