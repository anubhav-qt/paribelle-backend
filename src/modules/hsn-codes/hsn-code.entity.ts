import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('hsn_codes')
export class HsnCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  code: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'numeric', precision: 5, scale: 2, name: 'recommendedGstRate' })
  recommendedGstRate: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  category: string;

  @Column({ type: 'boolean', default: true, name: 'isActive' })
  isActive: boolean;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt: Date;
}
