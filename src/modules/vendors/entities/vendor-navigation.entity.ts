import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Vendor } from '../vendor.entity';

export enum NavigationPosition {
  HEADER = 'header',
  FOOTER = 'footer',
  BOTH = 'both',
}

@Entity('vendor_navigation')
export class VendorNavigation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'vendor_id' })
  @Index()
  vendorId: string;

  @ManyToOne(() => Vendor, (vendor) => vendor.navigationItems, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;

  @Column()
  label: string;

  @Column()
  url: string;

  @Column({ type: 'int', default: 0 })
  order: number;

  @Column({ type: 'uuid', nullable: true, name: 'parent_id' })
  parentId: string;

  @Column({ default: true, name: 'is_active' })
  isActive: boolean;

  @Column({
    type: 'enum',
    enum: NavigationPosition,
    default: NavigationPosition.HEADER,
  })
  position: NavigationPosition;

  @Column({ default: false, name: 'open_in_new_tab' })
  openInNewTab: boolean;
}
