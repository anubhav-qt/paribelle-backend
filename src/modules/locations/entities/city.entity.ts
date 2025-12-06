import { Entity, Column, PrimaryGeneratedColumn, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { SubLocation } from './sub-location.entity';

@Entity('cities')
export class City {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  state: string;

  @Column({ nullable: true, default: 'India' })
  country: string;

  @Column({ default: false })
  isUserCreated: boolean;

  @OneToMany(() => SubLocation, (subLocation) => subLocation.city)
  subLocations: SubLocation[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
