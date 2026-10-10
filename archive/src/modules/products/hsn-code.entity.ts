import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('hsn_codes')
@Index(['code'], { unique: true })
@Index(['category'])
export class HsnCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  code: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'recommended_gst_rate' })
  recommendedGstRate: number;

  @Column({ nullable: true })
  category: string;

  @Column({ default: true, name: 'is_active' })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
