import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { City } from './city.entity';

@Entity('sub_locations')
export class SubLocation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @ManyToOne(() => City, (city) => city.subLocations)
  @JoinColumn({ name: 'cityId' })
  city: City;

  @Column({ nullable: true })
  zipCode: string;

  @Column({ default: false })
  isUserCreated: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
