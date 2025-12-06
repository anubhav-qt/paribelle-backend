import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './product.entity';
import { Category } from '../categories/category.entity';
import { Vendor } from '../vendors/vendor.entity';
import { ProductsService } from './products.service';
import { ProductsExcelService } from './products-excel.service';
import { ProductsController } from './products.controller';
import { CategoriesModule } from '../categories/categories.module';

@Module({
  imports: [TypeOrmModule.forFeature([Product, Category, Vendor]), CategoriesModule],
  controllers: [ProductsController],
  providers: [ProductsService, ProductsExcelService],
  exports: [ProductsService, ProductsExcelService],
})
export class ProductsModule {}
