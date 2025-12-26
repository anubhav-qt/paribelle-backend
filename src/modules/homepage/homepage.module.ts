import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HomepageController } from './homepage.controller';
import { HomepageService } from './homepage.service';
import { CategoriesModule } from '../categories/categories.module';
import { ProductsModule } from '../products/products.module';
import { AdminModule } from '../admin/admin.module';
import { Vendor } from '../vendors/vendor.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Vendor]),
    CategoriesModule, 
    ProductsModule, 
    AdminModule,
  ],
  controllers: [HomepageController],
  providers: [HomepageService],
})
export class HomepageModule {}
