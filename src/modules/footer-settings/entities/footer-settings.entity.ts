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

  @Column({ type: 'varchar', length: 255 })
  aboutText: string;

  @Column({ type: 'jsonb', default: '[]' })
  socialLinks: SocialLink[];

  @Column({ type: 'jsonb', default: '[]' })
  customSections: FooterSection[];

  @Column({ type: 'jsonb' })
  contactInfo: ContactInfo;

  @Column({ type: 'text', nullable: true })
  copyrightText: string;

  @Column({ type: 'boolean', default: true })
  showCategories: boolean;

  @Column({ type: 'int', default: 6 })
  maxCategoriesDisplay: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
