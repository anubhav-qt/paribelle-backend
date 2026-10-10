import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminModule } from '../admin/admin.module';
import { Vendor } from './vendor.entity';
import { StoreController } from './store.controller';
import { StoreService } from './store.service';

@Module({
  imports: [TypeOrmModule.forFeature([Vendor]), AdminModule],
  controllers: [StoreController],
  providers: [StoreService],
  exports: [StoreService],
})
export class StoreModule {}
