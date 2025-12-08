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

  @Column()
  @Index()
  vendorId: string;

  @ManyToOne(() => Vendor, (vendor) => vendor.navigationItems, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'vendorId' })
  vendor: Vendor;

  @Column()
  label: string;

  @Column()
  url: string;

  @Column({ type: 'int', default: 0 })
  order: number;

  @Column({ nullable: true })
  parentId: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({
    type: 'enum',
    enum: NavigationPosition,
    default: NavigationPosition.HEADER,
  })
  position: NavigationPosition;

  @Column({ default: false })
  openInNewTab: boolean;
}
